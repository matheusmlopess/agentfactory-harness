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
})
