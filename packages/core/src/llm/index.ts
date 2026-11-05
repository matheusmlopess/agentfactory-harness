export type { LLMAdapter, StreamChunk, LLMStreamOptions, ToolDef, Provider } from './types.js'
import type { LLMAdapter, Provider } from './types.js'
import { AnthropicAdapter } from './anthropic-adapter.js'
import { OpenAIAdapter } from './openai-adapter.js'
import { store } from '../config/store.js'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export { AnthropicAdapter } from './anthropic-adapter.js'
export { OpenAIAdapter } from './openai-adapter.js'

export function createAdapter(provider: Provider, apiKey?: string): LLMAdapter {
  switch (provider) {
    case 'anthropic': return new AnthropicAdapter(apiKey ?? store.getKey('anthropic', 'ANTHROPIC_API_KEY'))
    case 'openai':    return new OpenAIAdapter(apiKey ?? store.getKey('openai', 'OPENAI_API_KEY'))
  }
}

/**
 * Determine the best provider to use.
 * Priority: LLM_PROVIDER env → provider with a configured API key → 'anthropic'.
 */
export function defaultProvider(): Provider {
  const p = process.env['LLM_PROVIDER']
  if (p === 'openai')    return 'openai'
  if (p === 'anthropic') return 'anthropic'
  // Auto-detect: use any provider that has a key configured in the store
  const hasAnthropic = !!(store.getKey('anthropic', 'ANTHROPIC_API_KEY'))
  const hasOpenAI    = !!(store.getKey('openai',    'OPENAI_API_KEY'))
  if (hasOpenAI && !hasAnthropic) return 'openai'
  if (hasAnthropic)               return 'anthropic'
  // Neither configured — try OpenAI last (common choice for new users)
  if (hasOpenAI) return 'openai'
  return 'anthropic'
}

export interface ModelEntry { id: string; label: string; provider: Provider }

/**
 * Fetch available models from the provider's API.
 * Only call when the provider has an API key configured.
 * Throws if the request fails (caller should catch and fall back).
 */
export async function listModels(provider: Provider, apiKey?: string): Promise<ModelEntry[]> {
  const key = apiKey ?? store.getKey(provider, provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY')
  if (!key) return []

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey: key })
    const resp = await client.models.list({ limit: 100 })
    return (resp.data as { id: string; display_name?: string }[])
      .map(m => ({ id: m.id, label: m.display_name ?? m.id, provider: 'anthropic' as Provider }))
      .sort((a, b) => b.id.localeCompare(a.id))  // newest first
  }

  if (provider === 'openai') {
    const client = new OpenAI({ apiKey: key })
    const entries: ModelEntry[] = []
    for await (const m of client.models.list()) {
      // Keep chat-capable models by ID prefix.
      // owned_by varies: 'openai' for legacy, 'openai-internal' for gpt-4o/o-series.
      // Exclude user fine-tunes and instruct variants.
      if (
        /^(gpt-|o\d|chatgpt-)/.test(m.id) &&
        !m.id.includes('instruct') &&
        !m.owned_by.startsWith('user-')
      ) {
        entries.push({ id: m.id, label: m.id, provider: 'openai' })
      }
    }
    return entries.sort((a, b) => b.id.localeCompare(a.id))
  }

  return []
}
