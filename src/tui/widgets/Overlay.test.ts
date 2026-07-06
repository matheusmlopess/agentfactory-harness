import { describe, it, expect, vi } from 'vitest'
import { Overlay } from './Overlay.js'
import { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import type { MouseEvent } from '../input/mouse.js'

const container: Rect = { row: 1, col: 10, height: 22, width: 70 }
const click = (row: number, col: number): MouseEvent =>
  ({ button: 'left', action: 'press', row, col, shift: false, ctrl: false, alt: false })

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[^m]*m|\x1b\[\d+;\d+H/g, '')
}

describe('Overlay geometry', () => {
  it('md tier caps width at 56 and centers in the container', () => {
    const ov = new Overlay({ title: 'T', tier: 'md', onDismiss: () => {} })
    const f = ov.layout(container, 8)
    expect(f.width).toBe(56)
    expect(f.height).toBe(10)
    expect(f.col).toBe(10 + Math.floor((70 - 56) / 2))
    expect(f.row).toBe(1 + Math.floor((22 - 10) / 2))
    expect(f.inner).toEqual({ row: f.row + 1, col: f.col + 1, height: 8, width: 54 })
  })

  it('narrow container clamps width to container-4 (sm/md/lg)', () => {
    const narrow: Rect = { row: 0, col: 0, height: 20, width: 40 }
    for (const tier of ['sm', 'md', 'lg'] as const) {
      const ov = new Overlay({ title: 'T', tier, onDismiss: () => {} })
      expect(ov.layout(narrow, 5).width).toBe(36)
    }
  })

  it('height clamps to container-4 for tall content', () => {
    const ov = new Overlay({ title: 'T', tier: 'lg', onDismiss: () => {} })
    expect(ov.layout(container, 100).height).toBe(18)
  })
})

describe('Overlay frame render', () => {
  it('draws border corners, title, and footer hint', () => {
    const ov = new Overlay({ title: 'Import Keys', tier: 'md', footerHint: 'Esc cancel', onDismiss: () => {} })
    const buf = new CellBuffer(24, 90)
    ov.renderFrame(buf, container, 6)
    const plain = stripAnsi(buf.diff(new CellBuffer(24, 90)))
    expect(plain).toContain('┌')
    expect(plain).toContain('┘')
    expect(plain).toContain(' Import Keys ')
    expect(plain).toContain(' Esc cancel ')
  })

  it('titleOverride replaces the configured title for dynamic headers', () => {
    const ov = new Overlay({ title: 'A', tier: 'sm', onDismiss: () => {} })
    const buf = new CellBuffer(24, 90)
    ov.renderFrame(buf, container, 4, 'Loading…')
    const plain = stripAnsi(buf.diff(new CellBuffer(24, 90)))
    expect(plain).toContain(' Loading… ')
    expect(plain).not.toContain(' A ')
  })
})

describe('Overlay dismissal convention', () => {
  it('Esc dismisses', () => {
    const onDismiss = vi.fn()
    const ov = new Overlay({ title: 'T', tier: 'sm', onDismiss })
    expect(ov.handleKey({ key: 'escape', raw: Buffer.from('\x1b') })).toBe(true)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('other keys are not handled', () => {
    const onDismiss = vi.fn()
    const ov = new Overlay({ title: 'T', tier: 'sm', onDismiss })
    expect(ov.handleKey({ key: 'enter', raw: Buffer.from('\r') })).toBe(false)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('click outside dismisses; click inside does not', () => {
    const onDismiss = vi.fn()
    const ov = new Overlay({ title: 'T', tier: 'md', onDismiss })
    const f = ov.layout(container, 8)
    expect(ov.handleMouse(click(0, 0), f)).toBe(true)
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(ov.handleMouse(click(f.row + 1, f.col + 1), f)).toBe(false)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('non-left / non-press events never dismiss', () => {
    const onDismiss = vi.fn()
    const ov = new Overlay({ title: 'T', tier: 'md', onDismiss })
    const f = ov.layout(container, 8)
    expect(ov.handleMouse({ ...click(0, 0), button: 'scroll_up' }, f)).toBe(false)
    expect(ov.handleMouse({ ...click(0, 0), action: 'release' }, f)).toBe(false)
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
