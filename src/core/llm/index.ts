export type { LLMAdapter, StreamChunk, LLMStreamOptions, ToolDef, Provider } from './types.js'
import type { LLMAdapter, Provider } from './types.js'
import { AnthropicAdapter } from './anthropic-adapter.js'
import { OpenAIAdapter } from './openai-adapter.js'

export { AnthropicAdapter } from './anthropic-adapter.js'
export { OpenAIAdapter } from './openai-adapter.js'

export function createAdapter(provider: Provider, apiKey?: string): LLMAdapter {
  switch (provider) {
    case 'anthropic': return new AnthropicAdapter(apiKey)
    case 'openai':    return new OpenAIAdapter(apiKey)
  }
}

/** Read LLM_PROVIDER from env, fall back to 'anthropic'. */
export function defaultProvider(): Provider {
  const p = process.env['LLM_PROVIDER']
  if (p === 'openai') return 'openai'
  return 'anthropic'
}
