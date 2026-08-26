import { describe, it, expect } from 'vitest'
import { CellBuffer } from './cell-buffer.js'

const stripAnsi = (s: string): string => s.replace(/\x1b\[[^m]*m|\x1b\[\d+;\d+H/g, '')

describe('CellBuffer', () => {
  it('writes a string at given position', () => {
    const buf = new CellBuffer(5, 20)
    buf.write(2, 3, 'hello', { fg: 75 })
    // Diff against empty should produce ANSI output containing the chars
    const empty = new CellBuffer(5, 20)
    const out = buf.diff(empty)
    expect(stripAnsi(out)).toContain('hello')
  })

  it('clips writes outside bounds', () => {
    const buf = new CellBuffer(5, 10)
    expect(() => buf.write(10, 0, 'out of bounds')).not.toThrow()
    expect(() => buf.write(0, 10, 'also out')).not.toThrow()
  })

  it('clone produces independent copy', () => {
    const buf = new CellBuffer(3, 10)
    buf.write(0, 0, 'original')
    const clone = buf.clone()
    buf.write(0, 0, 'modified!')
    // Clone should still reflect 'original'
    const empty = new CellBuffer(3, 10)
    const cloneDiff = clone.diff(empty)
    expect(stripAnsi(cloneDiff)).toContain('original')
  })

  it('diff returns empty string when buffers are identical', () => {
    const a = new CellBuffer(3, 10)
    a.write(1, 1, 'same')
    const b = a.clone()
    expect(a.diff(b)).toBe('')
  })
})
