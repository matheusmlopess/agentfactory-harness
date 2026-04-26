import Anthropic from '@anthropic-ai/sdk'
import type {
  MessageParam,
  TextBlockParam,
  ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/messages.js'
import { type Session } from './session.js'
import { listTools, dispatch } from './tools/index.js'
import { runHook } from './hooks.js'

const DEFAULT_MODEL = 'claude-opus-4-7'
const DEFAULT_MAX_TOKENS = 8192

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; name: string; id: string }
  | { type: 'tool_result'; id: string; content: string }
  | { type: 'turn_end'; stop_reason: string }
  | { type: 'error'; error: Error }

export interface AgentLoopOptions {
  maxTurns?: number
  model?: string
  signal?: AbortSignal
  systemPrompt?: string
}

// Mutable state tracked across one streaming response
interface StreamState {
  textAccum: string
  toolBlocks: Map<number, { id: string; name: string; inputAccum: string }>
  stopReason: string
}

export async function* agentLoop(
  session: Session,
  opts: AgentLoopOptions = {}
): AsyncIterable<AgentEvent> {
  const {
    maxTurns = 20,
    model = DEFAULT_MODEL,
    signal,
    systemPrompt = 'You are a helpful assistant in the factory ITUI agent shell.',
  } = opts

  const client = new Anthropic()
  const tools = listTools()

  const apiTools = tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchemaJson,
  }))

  let turns = 0

  while (turns < maxTurns) {
    if (signal?.aborted) return

    const state: StreamState = {
      textAccum: '',
      toolBlocks: new Map(),
      stopReason: 'end_turn',
    }

    await runHook('StepStart', { turn: turns })

    const stream = await client.messages.create({
      model,
      max_tokens: DEFAULT_MAX_TOKENS,
      system: systemPrompt,
      messages: session.getHistory() as MessageParam[],
      stream: true,
      ...(apiTools.length > 0 ? { tools: apiTools as Anthropic.Tool[] } : {}),
    })

    // Accumulate streaming events; yield text deltas live
    for await (const event of stream) {
      if (signal?.aborted) return

      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          state.toolBlocks.set(event.index, {
            id: event.content_block.id,
            name: event.content_block.name,
            inputAccum: '',
          })
          yield { type: 'tool_start', name: event.content_block.name, id: event.content_block.id }
        }
      }

      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          state.textAccum += event.delta.text
          yield { type: 'text_delta', delta: event.delta.text }
        } else if (event.delta.type === 'input_json_delta') {
          const block = state.toolBlocks.get(event.index)
          if (block) block.inputAccum += event.delta.partial_json
        }
      }

      if (event.type === 'message_delta') {
        state.stopReason = event.delta.stop_reason ?? 'end_turn'
      }
    }

    // Add assistant message to history
    const assistantContent: Array<TextBlockParam | ToolUseBlockParam> = []
    if (state.textAccum) {
      assistantContent.push({ type: 'text', text: state.textAccum })
    }

    // Dispatch tool calls collected during this turn
    const toolResultParts: Anthropic.ToolResultBlockParam[] = []
    for (const [, block] of state.toolBlocks) {
      let parsedInput: unknown = {}
      try {
        if (block.inputAccum) parsedInput = JSON.parse(block.inputAccum)
      } catch {
        parsedInput = {}
      }

      assistantContent.push({
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: parsedInput as Record<string, unknown>,
      })

      const hook = await runHook('PreToolUse', { tool: block.name, input: parsedInput })
      let result: string
      if (!hook.continue) {
        result = `Tool use blocked by PreToolUse hook`
      } else {
        result = await dispatch(block.name, parsedInput)
        await runHook('PostToolUse', { tool: block.name, result })
      }

      yield { type: 'tool_result', id: block.id, content: result }
      toolResultParts.push({ type: 'tool_result', tool_use_id: block.id, content: result })
    }

    session.addMessage({ role: 'assistant', content: assistantContent })

    await runHook('StepComplete', { turn: turns, stop_reason: state.stopReason })
    yield { type: 'turn_end', stop_reason: state.stopReason }

    if (state.stopReason === 'end_turn' || state.toolBlocks.size === 0) break

    // Add tool results and loop for next turn
    session.addMessage({ role: 'user', content: toolResultParts })
    turns++
  }
}
