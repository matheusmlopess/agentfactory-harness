import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { LLMAdapter, LLMStreamOptions, Provider, StreamChunk } from './types.js'

export class AnthropicAdapter implements LLMAdapter {
  readonly provider: Provider = 'anthropic'
  readonly defaultModel = 'claude-opus-4-7'

  readonly #client: Anthropic

  constructor(apiKey?: string) {
    this.#client = new Anthropic({ apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'] })
  }

  async *stream(
    messages: MessageParam[],
    opts: LLMStreamOptions,
  ): AsyncIterable<StreamChunk> {
    const { model, systemPrompt, tools, maxTokens = 8192, signal } = opts

    const apiTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchemaJson,
    })) as Anthropic.Tool[]

    const sdkStream = await this.#client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      stream: true,
      ...(apiTools.length > 0 ? { tools: apiTools } : {}),
    })

    for await (const event of sdkStream) {
      if (signal?.aborted) return

      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        yield { type: 'tool_start', id: event.content_block.id, name: event.content_block.name }
      }

      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text_delta', text: event.delta.text }
        } else if (event.delta.type === 'input_json_delta') {
          yield { type: 'tool_input_delta', index: event.index, json: event.delta.partial_json }
        }
      }

      if (event.type === 'message_delta') {
        yield { type: 'message_end', stop_reason: event.delta.stop_reason ?? 'end_turn' }
      }
    }
  }
}
