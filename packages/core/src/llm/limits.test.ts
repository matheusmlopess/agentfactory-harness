import { describe, it, expect } from 'vitest'
import { maxOutputTokens } from './limits.js'

describe('maxOutputTokens', () => {
  it('claude models get 8192', () => {
    expect(maxOutputTokens('claude-sonnet-4-5')).toBe(8192)
    expect(maxOutputTokens('claude-3-haiku-20240307')).toBe(8192)
  })

  it('large openai models get 16384', () => {
    expect(maxOutputTokens('gpt-4o')).toBe(16384)
    expect(maxOutputTokens('gpt-4o-mini')).toBe(16384)
    expect(maxOutputTokens('gpt-5-turbo')).toBe(16384)
    expect(maxOutputTokens('o3-mini')).toBe(16384)
  })

  it('unknown models fall back to 4096 (raised from the old 2048)', () => {
    expect(maxOutputTokens('mistral-large')).toBe(4096)
    expect(maxOutputTokens('deepseek-chat')).toBe(4096)
  })

  it('undefined model falls back to 4096', () => {
    expect(maxOutputTokens(undefined)).toBe(4096)
  })
})
