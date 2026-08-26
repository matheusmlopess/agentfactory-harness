import type {
  MessageParam,
  TextBlockParam,
  ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/messages.js'
import type Anthropic from '@anthropic-ai/sdk'
import { type Session } from './session.js'
import { listTools, dispatch } from './tools/index.js'
import { runHook } from './hooks.js'
import { createAdapter, defaultProvider, type LLMAdapter } from './llm/index.js'
import { maxOutputTokens } from './llm/limits.js'

export type AgentEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'tool_start'; name: string; id: string }
  | { type: 'tool_result'; id: string; content: string }
  | { type: 'turn_end'; stop_reason: string }
  | { type: 'error'; error: Error }
  | { type: 'stats'; inputTokens: number; outputTokens: number; toolCalls: number; turns: number; model: string }

export interface AgentLoopOptions {
  maxTurns?: number
  model?: string
  signal?: AbortSignal
  systemPrompt?: string
  adapter?: LLMAdapter
  /** Plain-chat mode: don't send tool definitions (saves ~220 input tokens/call). */
  noTools?: boolean
  /** Output-token ceiling; defaults to a model-aware limit (limits.ts). */
  maxTokens?: number
}

const DEFAULT_SYSTEM = 'You are a helpful assistant in the factory ITUI agent shell.'

export async function* agentLoop(
  session: Session,
  opts: AgentLoopOptions = {}
): AsyncIterable<AgentEvent> {
  const {
    maxTurns = 20,
    signal,
    systemPrompt = DEFAULT_SYSTEM,
  } = opts

  const adapter = opts.adapter ?? createAdapter(defaultProvider())
  const model = opts.model ?? adapter.defaultModel
  const maxTokens = opts.maxTokens ?? maxOutputTokens(model)
  const tools = opts.noTools ? [] : listTools()

  const toolDefs = tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchemaJson: t.inputSchemaJson,
  }))

  let turns          = 0
  let totalInputTok  = 0
  let totalOutputTok = 0
  let totalToolCalls = 0
  const startMs      = Date.now()

  while (turns < maxTurns) {
    if (signal?.aborted) return

    // Per-turn accumulation
    let textAccum = ''
    let stopReason = 'end_turn'
    const toolBlocks = new Map<number, { id: string; name: string; inputAccum: string }>()

    // Real usage from the provider API (falls back to estimate if absent)
    let turnInputTok = 0
    let turnOutputTok = 0
    let gotUsage = false

    await runHook('StepStart', { turn: turns })

    try {
      for await (const chunk of adapter.stream(session.getHistory() as MessageParam[], {
        model,
        systemPrompt,
        tools: toolDefs,
        maxTokens,
        ...(signal !== undefined ? { signal } : {}),
      })) {
        if (signal?.aborted) return

        switch (chunk.type) {
          case 'text_delta':
            textAccum += chunk.text
            yield { type: 'text_delta', delta: chunk.text }
            break

          case 'tool_start':
            toolBlocks.set(toolBlocks.size, { id: chunk.id, name: chunk.name, inputAccum: '' })
            yield { type: 'tool_start', name: chunk.name, id: chunk.id }
            break

          case 'tool_input_delta': {
            const block = toolBlocks.get(chunk.index)
            if (block) block.inputAccum += chunk.json
            break
          }

          case 'usage':
            turnInputTok  = chunk.inputTokens
            turnOutputTok = chunk.outputTokens
            gotUsage = true
            break

          case 'message_end':
            stopReason = chunk.stop_reason
            break
        }
      }
    } catch (err) {
      yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) }
      return
    }

    // Build assistant message for history
    const assistantContent: Array<TextBlockParam | ToolUseBlockParam> = []
    if (textAccum) assistantContent.push({ type: 'text', text: textAccum })

    const toolResultParts: Anthropic.ToolResultBlockParam[] = []
    for (const [, block] of toolBlocks) {
      let parsedInput: unknown = {}
      try {
        if (block.inputAccum) parsedInput = JSON.parse(block.inputAccum)
      } catch { parsedInput = {} }

      assistantContent.push({
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: parsedInput as Record<string, unknown>,
      })

      const hook = await runHook('PreToolUse', { tool: block.name, input: parsedInput })
      let result: string
      if (!hook.continue) {
        result = 'Tool use blocked by PreToolUse hook'
      } else {
        result = await dispatch(block.name, parsedInput)
        await runHook('PostToolUse', { tool: block.name, result })
      }

      yield { type: 'tool_result', id: block.id, content: result }
      toolResultParts.push({ type: 'tool_result', tool_use_id: block.id, content: result })
    }

    session.addMessage({ role: 'assistant', content: assistantContent })

    // Accumulate stats — prefer real API usage, fall back to estimate
    if (!gotUsage) {
      turnInputTok  = Math.ceil(JSON.stringify(session.getHistory()).length / 4)
      turnOutputTok = Math.ceil(textAccum.length / 4)
    }
    totalInputTok  += turnInputTok
    totalOutputTok += turnOutputTok
    totalToolCalls += toolBlocks.size
    turns++

    await runHook('StepComplete', { turn: turns, stop_reason: stopReason })
    yield { type: 'turn_end', stop_reason: stopReason }

    // Emit live stats after every turn so the UI can update progressively
    yield {
      type: 'stats',
      inputTokens:  totalInputTok,
      outputTokens: totalOutputTok,
      toolCalls:    totalToolCalls,
      turns,
      model,
    }

    if (stopReason === 'end_turn' || toolBlocks.size === 0) break

    session.addMessage({ role: 'user', content: toolResultParts })
  }

  void startMs  // suppress unused warning — useful in future for elapsedMs
}
