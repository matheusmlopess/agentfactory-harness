import OpenAI from 'openai'
import type { MessageParam, ToolResultBlockParam, ToolUseBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { LLMAdapter, LLMStreamOptions, Provider, StreamChunk, ToolDef } from './types.js'

type OAIMessage = OpenAI.Chat.ChatCompletionMessageParam

/** Convert our canonical Anthropic MessageParam history to OpenAI messages. */
function toOpenAIMessages(
  messages: MessageParam[],
  systemPrompt: string,
): OAIMessage[] {
  const result: OAIMessage[] = [{ role: 'system', content: systemPrompt }]

  for (const msg of messages) {
    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        result.push({ role: 'user', content: msg.content })
        continue
      }
      // content is an array — split tool_results into tool-role messages
      const textParts: string[] = []
      for (const block of msg.content) {
        if (block.type === 'text') {
          textParts.push(block.text)
        } else if (block.type === 'tool_result') {
          const b = block as ToolResultBlockParam
          result.push({
            role: 'tool',
            tool_call_id: b.tool_use_id,
            content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content),
          })
        }
      }
      if (textParts.length > 0) {
        result.push({ role: 'user', content: textParts.join('\n') })
      }
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        result.push({ role: 'assistant', content: msg.content })
        continue
      }
      const textParts: string[] = []
      const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = []

      for (const block of msg.content) {
        if (block.type === 'text') {
          textParts.push(block.text)
        } else if (block.type === 'tool_use') {
          const b = block as ToolUseBlockParam
          toolCalls.push({
            id: b.id,
            type: 'function',
            function: {
              name: b.name,
              arguments: typeof b.input === 'string' ? b.input : JSON.stringify(b.input),
            },
          })
        }
      }

      result.push({
        role: 'assistant',
        content: textParts.join('\n') || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      })
    }
  }

  return result
}

function toOpenAITools(tools: ToolDef[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchemaJson,
    },
  }))
}

export class OpenAIAdapter implements LLMAdapter {
  readonly provider: Provider = 'openai'
  readonly defaultModel = 'gpt-4o'

  readonly #client: OpenAI

  constructor(apiKey?: string) {
    this.#client = new OpenAI({ apiKey: apiKey ?? process.env['OPENAI_API_KEY'] })
  }

  async *stream(
    messages: MessageParam[],
    opts: LLMStreamOptions,
  ): AsyncIterable<StreamChunk> {
    const { model, systemPrompt, tools, maxTokens = 4096, signal } = opts

    const oaiMessages = toOpenAIMessages(messages, systemPrompt)
    const oaiTools = toOpenAITools(tools)

    // Reasoning models (o1/o3/o4, gpt-5) require max_completion_tokens and reject
    // the legacy max_tokens parameter. Pick the right field per model.
    const isReasoning = /^(o\d|gpt-5)/.test(model)
    const tokenParam = isReasoning
      ? { max_completion_tokens: maxTokens }
      : { max_tokens: maxTokens }

    const sdkStream = await this.#client.chat.completions.create({
      model,
      ...tokenParam,
      messages: oaiMessages,
      stream: true,
      stream_options: { include_usage: true },
      ...(oaiTools.length > 0 ? { tools: oaiTools } : {}),
    })

    const toolCallAccum = new Map<number, { id: string; name: string }>()

    for await (const chunk of sdkStream) {
      if (signal?.aborted) return

      // Final chunk (with include_usage) has empty choices but a usage object
      if (chunk.usage) {
        yield {
          type: 'usage',
          inputTokens:  chunk.usage.prompt_tokens     ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
        }
      }

      const choice = chunk.choices[0]
      if (!choice) continue
      const delta = choice.delta

      if (delta.content) {
        yield { type: 'text_delta', text: delta.content }
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          if (tc.id && tc.function?.name) {
            toolCallAccum.set(idx, { id: tc.id, name: tc.function.name })
            yield { type: 'tool_start', id: tc.id, name: tc.function.name }
          }
          if (tc.function?.arguments) {
            yield { type: 'tool_input_delta', index: idx, json: tc.function.arguments }
          }
        }
      }

      if (choice.finish_reason) {
        const stopReason = choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn'
        yield { type: 'message_end', stop_reason: stopReason }
      }
    }
  }
}
