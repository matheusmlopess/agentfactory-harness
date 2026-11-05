import { describe, it, expect } from 'vitest'
import { maskSecret } from './mask.js'

describe('maskSecret', () => {
  it('masks after the first dash past index 3 (sk-ant-style keys)', () => {
    expect(maskSecret('sk-ant-api03-abcdef123456', 'apikey')).toBe('sk-ant-…▓▓▓▓')
  })

  it('falls back to a 6-char prefix when no meaningful dash', () => {
    expect(maskSecret('AIzaSyExample123', 'apikey')).toBe('AIzaSy…▓▓▓▓')
  })

  it('short values still get masked with their full prefix', () => {
    expect(maskSecret('abc', 'token')).toBe('abc…▓▓▓▓')
  })

  it('empty value renders empty', () => {
    expect(maskSecret('', 'apikey')).toBe('')
  })

  it('urls are never masked', () => {
    expect(maskSecret('http://localhost:11434', 'url')).toBe('http://localhost:11434')
  })

  it('defaults to apikey masking when fieldType omitted', () => {
    expect(maskSecret('sk-proj-xyz123')).toBe('sk-proj-…▓▓▓▓')
  })
})
