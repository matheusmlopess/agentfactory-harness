import { describe, it, expect } from 'vitest'
import { routeWire } from './Wire.js'

describe('routeWire', () => {
  it('returns empty for same point', () => {
    expect(routeWire({ row: 2, col: 5 }, { row: 2, col: 5 })).toHaveLength(0)
  })

  it('routes a horizontal wire (same row)', () => {
    const pts = routeWire({ row: 3, col: 2 }, { row: 3, col: 8 })
    // All points should be on the same row
    for (const pt of pts) {
      expect(pt.row).toBe(3)
    }
    // Should include the from and to columns
    const cols = pts.map(p => p.col)
    expect(cols).toContain(2)
    expect(cols).toContain(8)
  })

  it('routes an L-shape (different row and col)', () => {
    const pts = routeWire({ row: 1, col: 2 }, { row: 5, col: 10 })
    expect(pts.length).toBeGreaterThan(0)
    // Should have both horizontal and vertical segments
    const rows = new Set(pts.map(p => p.row))
    const cols = new Set(pts.map(p => p.col))
    expect(rows.size).toBeGreaterThan(1)  // at least 2 distinct rows
    expect(cols.size).toBeGreaterThan(1)  // at least 2 distinct cols
  })

  it('routes right-to-left wire', () => {
    const pts = routeWire({ row: 3, col: 10 }, { row: 3, col: 2 })
    const cols = pts.map(p => p.col)
    expect(cols).toContain(10)
    expect(cols).toContain(2)
  })

  it('last point is an arrow character', () => {
    const pts = routeWire({ row: 1, col: 0 }, { row: 1, col: 5 })
    const last = pts[pts.length - 1]
    expect(last?.char).toBe('►')
  })

  it('produces no duplicate (row, col) pairs', () => {
    const pts = routeWire({ row: 0, col: 0 }, { row: 4, col: 8 })
    const seen = new Set<string>()
    for (const pt of pts) {
      const key = `${pt.row},${pt.col}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  // ── Regression: infinite-loop hangs (previously froze the app / OOM) ─────

  it('terminates on a vertical wire (same col, rows differ) — downward', () => {
    const pts = routeWire({ row: 0, col: 10 }, { row: 4, col: 10 })
    expect(pts.every(p => p.col === 10)).toBe(true)
    expect(pts[pts.length - 1]).toEqual({ row: 4, col: 10, char: '▼' })
  })

  it('terminates on a vertical wire — upward', () => {
    const pts = routeWire({ row: 6, col: 3 }, { row: 1, col: 3 })
    expect(pts.every(p => p.col === 3)).toBe(true)
    expect(pts[pts.length - 1]).toEqual({ row: 1, col: 3, char: '▲' })
  })

  it('terminates when target is exactly 1 col to the left (midCol === to.col)', () => {
    const pts = routeWire({ row: 1, col: 5 }, { row: 6, col: 4 })
    // midCol = 4 = to.col ⇒ leading dash at (1,5)? no — h1 = sign(4−5) = −1,
    // so the run from col 5 to midCol 4 paints (1,5), then vertical at col 4,
    // ending in a vertical arrow (no trailing horizontal run).
    expect(pts[pts.length - 1]).toEqual({ row: 6, col: 4, char: '▼' })
  })

  it('is bounded and duplicate-free for every from/to pair on a small grid', () => {
    for (let fr = -2; fr <= 6; fr++) {
      for (let fc = -2; fc <= 6; fc++) {
        for (let tr = -2; tr <= 6; tr++) {
          for (let tc = -2; tc <= 6; tc++) {
            const pts = routeWire({ row: fr, col: fc }, { row: tr, col: tc })
            expect(pts.length).toBeLessThanOrEqual(
              Math.abs(tr - fr) + Math.abs(tc - fc) + 2
            )
            const seen = new Set(pts.map(p => `${p.row},${p.col}`))
            expect(seen.size).toBe(pts.length)
          }
        }
      }
    }
  })

  it('consecutive points are 4-adjacent (contiguous path)', () => {
    const routes = [
      routeWire({ row: 0, col: 0 }, { row: 5, col: 12 }),
      routeWire({ row: 5, col: 12 }, { row: 0, col: 0 }),
      routeWire({ row: 2, col: 8 }, { row: 7, col: 8 }),
      routeWire({ row: 4, col: 9 }, { row: 0, col: 3 }),
    ]
    for (const pts of routes) {
      for (let i = 1; i < pts.length; i++) {
        const d = Math.abs(pts[i]!.row - pts[i - 1]!.row) +
                  Math.abs(pts[i]!.col - pts[i - 1]!.col)
        expect(d).toBe(1)
      }
    }
  })

  // ── Corner glyph orientation for all four L directions ──────────────────

  it('left-to-right descending uses ╮ … ╰ … ►', () => {
    const chars = routeWire({ row: 0, col: 0 }, { row: 4, col: 8 }).map(p => p.char)
    expect(chars).toContain('╮')
    expect(chars).toContain('╰')
    expect(chars[chars.length - 1]).toBe('►')
  })

  it('right-to-left descending uses ╭ … ╯ … ◄', () => {
    const chars = routeWire({ row: 0, col: 8 }, { row: 4, col: 0 }).map(p => p.char)
    expect(chars).toContain('╭')
    expect(chars).toContain('╯')
    expect(chars[chars.length - 1]).toBe('◄')
  })

  it('left-to-right ascending uses ╯ … ╭ … ►', () => {
    const chars = routeWire({ row: 4, col: 0 }, { row: 0, col: 8 }).map(p => p.char)
    expect(chars).toContain('╯')
    expect(chars).toContain('╭')
    expect(chars[chars.length - 1]).toBe('►')
  })

  it('right-to-left ascending uses ╰ … ╮ … ◄', () => {
    const chars = routeWire({ row: 4, col: 8 }, { row: 0, col: 0 }).map(p => p.char)
    expect(chars).toContain('╰')
    expect(chars).toContain('╮')
    expect(chars[chars.length - 1]).toBe('◄')
  })
})
