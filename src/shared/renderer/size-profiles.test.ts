import { describe, it, expect } from 'vitest'
import { SIZE_PROFILES, sizeCheck, renderTooSmall } from './size-profiles.js'
import { CellBuffer } from './cell-buffer.js'

const compact = SIZE_PROFILES[0]!

describe('sizeCheck', () => {
  it('passes at exactly the minimum', () => {
    expect(sizeCheck(24, 80, compact)).toEqual({ ok: true, deficitCols: 0, deficitRows: 0 })
  })

  it('fails below the minimum with deficits', () => {
    expect(sizeCheck(20, 70, compact)).toEqual({ ok: false, deficitCols: 10, deficitRows: 4 })
  })

  it('profiles escalate: standard fails where compact passes', () => {
    const standard = SIZE_PROFILES[1]!
    expect(sizeCheck(24, 80, compact).ok).toBe(true)
    expect(sizeCheck(24, 80, standard).ok).toBe(false)
  })
})

describe('renderTooSmall', () => {
  it('renders the guard message with current vs required size', () => {
    const buf = new CellBuffer(20, 60)
    renderTooSmall(buf, 20, 60, compact)
    const plain = buf.diff(new CellBuffer(20, 60)).replace(/\x1b\[[^m]*m|\x1b\[\d+;\d+H/g, '')
    expect(plain).toContain('Terminal too small')
    expect(plain).toContain('current 60×20')
    expect(plain).toContain('minimum 80×24')
    expect(plain).toContain('Ctrl+Q quit')
  })
})
