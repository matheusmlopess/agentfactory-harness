import { describe, it, expect } from 'vitest'
import { BashTool } from './bash.js'

describe('BashTool', () => {
  it('runs a simple command and returns stdout', async () => {
    const result = await BashTool.run({ command: 'echo hello' })
    expect(result.trim()).toBe('hello')
  })

  it('returns non-zero exit code error message', async () => {
    const result = await BashTool.run({ command: 'exit 1' })
    expect(result).toMatch(/Error/)
  })

  it('includes stderr in output', async () => {
    const result = await BashTool.run({ command: 'echo warn >&2' })
    expect(result).toContain('warn')
  })

  it('validates input with Zod — rejects missing command', () => {
    const parsed = BashTool.inputSchema.safeParse({})
    expect(parsed.success).toBe(false)
  })

  it('is marked non-concurrent', () => {
    expect(BashTool.concurrent).toBe(false)
  })
})
