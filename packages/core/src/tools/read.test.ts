import { describe, it, expect } from 'vitest'
import { ReadTool } from './read.js'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('ReadTool', () => {
  const tmpFile = join(tmpdir(), `factory-read-test-${Date.now()}.txt`)

  it('reads an existing file', async () => {
    writeFileSync(tmpFile, 'hello from read tool')
    const result = await ReadTool.run({ file_path: tmpFile })
    expect(result).toBe('hello from read tool')
  })

  it('returns an error message for a missing file', async () => {
    const result = await ReadTool.run({ file_path: '/nonexistent/path/file.txt' })
    expect(result).toMatch(/Error/)
  })

  it('validates input — rejects missing file_path', () => {
    const parsed = ReadTool.inputSchema.safeParse({})
    expect(parsed.success).toBe(false)
  })

  it('is marked concurrent', () => {
    expect(ReadTool.concurrent).toBe(true)
  })
})
