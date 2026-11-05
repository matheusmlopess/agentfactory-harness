/**
 * Characterization tests for computeLayout + drawBorder (Phase 0 regression net).
 * These freeze today's exact geometry before the P3/P4 layout changes.
 */
import { describe, it, expect } from 'vitest'
import { computeLayout, drawBorder, type Rect } from './layout.js'
import { CellBuffer } from './cell-buffer.js'
import { Colors } from './theme.js'

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[^m]*m|\x1b\[\d+;\d+H/g, '')
}

describe('computeLayout', () => {
  it('80×24 — exact rects (session 40%, canvas 70/agents 30, full-height right column)', () => {
    const l = computeLayout(24, 80)
    expect(l.tabBar).toEqual<Rect>({ row: 0, col: 0, height: 1, width: 80 })
    expect(l.session).toEqual<Rect>({ row: 1, col: 0, height: 22, width: 32 })
    expect(l.canvas).toEqual<Rect>({ row: 1, col: 32, height: 15, width: 48 })
    expect(l.agents).toEqual<Rect>({ row: 16, col: 32, height: 7, width: 48 })
    expect(l.terminal).toEqual<Rect>({ row: 1, col: 32, height: 22, width: 48 })
    expect(l.config).toEqual<Rect>({ row: 1, col: 32, height: 22, width: 48 })
    expect(l.statusBar).toEqual<Rect>({ row: 23, col: 0, height: 1, width: 80 })
  })

  it('120×40 — exact rects', () => {
    const l = computeLayout(40, 120)
    expect(l.session).toEqual<Rect>({ row: 1, col: 0, height: 38, width: 48 })
    expect(l.canvas).toEqual<Rect>({ row: 1, col: 48, height: 26, width: 72 })
    expect(l.agents).toEqual<Rect>({ row: 27, col: 48, height: 12, width: 72 })
    expect(l.terminal).toEqual<Rect>({ row: 1, col: 48, height: 38, width: 72 })
    expect(l.statusBar).toEqual<Rect>({ row: 39, col: 0, height: 1, width: 120 })
  })

  it('canvas + agents tile the right column exactly', () => {
    for (const [rows, cols] of [[24, 80], [40, 120], [30, 100], [25, 81]] as const) {
      const l = computeLayout(rows, cols)
      expect(l.canvas.height + l.agents.height).toBe(l.terminal.height)
      expect(l.agents.row).toBe(l.canvas.row + l.canvas.height)
      expect(l.session.width + l.canvas.width).toBe(cols)
    }
  })
})

describe('drawBorder', () => {
  function renderPlain(rect: Rect, title: string, focused: boolean): { plain: string; raw: string } {
    const buf = new CellBuffer(10, 20)
    drawBorder(buf, rect, title, focused)
    const raw = buf.diff(new CellBuffer(10, 20))
    return { plain: stripAnsi(raw), raw }
  }

  const rect: Rect = { row: 1, col: 2, height: 5, width: 10 }

  it('draws corners, edges, and inline title', () => {
    const { plain } = renderPlain(rect, 'Test', false)
    expect(plain).toContain('┌')
    expect(plain).toContain('┐')
    expect(plain).toContain('└')
    expect(plain).toContain('┘')
    expect(plain).toContain(' Test ')
  })

  it('focused border uses the active color, unfocused the base color', () => {
    const { raw: focusedRaw } = renderPlain(rect, '', true)
    const { raw: normalRaw } = renderPlain(rect, '', false)
    expect(focusedRaw).toContain(`38;5;${Colors.focus}m`)
    expect(normalRaw).toContain(`38;5;${Colors.border}m`)
  })
})
