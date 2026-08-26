import { describe, it, expect, vi } from 'vitest'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}))
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({ chat: { completions: { create: vi.fn() } } })),
}))

import { createAdapter, defaultProvider } from './index.js'
import { AnthropicAdapter } from './anthropic-adapter.js'
import { OpenAIAdapter } from './openai-adapter.js'

describe('createAdapter', () => {
  it('returns AnthropicAdapter for "anthropic"', () => {
    expect(createAdapter('anthropic', 'k')).toBeInstanceOf(AnthropicAdapter)
  })

  it('returns OpenAIAdapter for "openai"', () => {
    expect(createAdapter('openai', 'k')).toBeInstanceOf(OpenAIAdapter)
  })

  it('AnthropicAdapter has correct provider and defaultModel', () => {
    const a = createAdapter('anthropic', 'k')
    expect(a.provider).toBe('anthropic')
    expect(a.defaultModel).toBe('claude-opus-4-7')
  })

  it('OpenAIAdapter has correct provider and defaultModel', () => {
    const a = createAdapter('openai', 'k')
    expect(a.provider).toBe('openai')
    expect(a.defaultModel).toBe('gpt-4o')
  })
})

describe('defaultProvider', () => {
  it('returns anthropic when LLM_PROVIDER is unset', () => {
    delete process.env['LLM_PROVIDER']
    expect(defaultProvider()).toBe('anthropic')
  })

  it('returns openai when LLM_PROVIDER=openai', () => {
    process.env['LLM_PROVIDER'] = 'openai'
    expect(defaultProvider()).toBe('openai')
    delete process.env['LLM_PROVIDER']
  })
})
