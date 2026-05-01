import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'

export type Provider = 'anthropic' | 'openai'

/**
 * Normalised streaming chunk produced by every LLMAdapter.
 * agentLoop consumes these instead of provider-specific SDK events.
 */
export type StreamChunk =
  | { type: 'text_delta';       text: string }
  | { type: 'tool_start';       id: string; name: string }
  | { type: 'tool_input_delta'; index: number; json: string }
  | { type: 'message_end';      stop_reason: string }

export interface ToolDef {
  name: string
  description: string
  inputSchemaJson: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface LLMStreamOptions {
  model: string
  systemPrompt: string
  tools: ToolDef[]
  maxTokens?: number
  signal?: AbortSignal
}

/**
 * Provider-agnostic streaming interface.
 * History is passed in Anthropic MessageParam format (our canonical internal
 * format) — adapters convert to their own wire format internally.
 */
export interface LLMAdapter {
  readonly provider: Provider
  readonly defaultModel: string
  stream(messages: MessageParam[], opts: LLMStreamOptions): AsyncIterable<StreamChunk>
}
