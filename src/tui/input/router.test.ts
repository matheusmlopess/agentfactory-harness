/**
 * Characterization tests for InputRouter (Phase 0 regression net).
 * Freezes today's dispatch contract: keys go to panels[focusedIdx],
 * mouse goes to the first panel whose rect contains the point.
 * NOTE: Phase 3 deliberately replaces this contract (TabEntry-based routing);
 * these tests are updated in that same commit.
 */
import { describe, it, expect } from 'vitest'
import { InputRouter } from './router.js'
import { Panel } from '../panels/Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { KeyEvent } from './keyboard.js'
import type { MouseEvent } from './mouse.js'
import type { Rect } from '../renderer/layout.js'

class FakePanel extends Panel {
  keys: KeyEvent[] = []
  mice: MouseEvent[] = []
  constructor(rect: Rect, private consume = true) {
    super(rect)
  }
  override render(_buf: CellBuffer): void {}
  override onKey(e: KeyEvent): boolean {
    this.keys.push(e)
    return this.consume
  }
  override onMouse(e: MouseEvent): boolean {
    this.mice.push(e)
    return this.consume
  }
}

const key = (k: string): KeyEvent => ({ key: k, raw: Buffer.from(k) })
const click = (row: number, col: number): MouseEvent =>
  ({ button: 'left', action: 'press', row, col, shift: false, ctrl: false, alt: false })

describe('InputRouter — key dispatch', () => {
  it('routes keys to panels[focusedIdx]', () => {
    const a = new FakePanel({ row: 1, col: 0, height: 10, width: 40 })
    const b = new FakePanel({ row: 1, col: 40, height: 10, width: 40 })
    const router = new InputRouter()
    expect(router.dispatch(key('x'), [a, b], 1)).toBe(true)
    expect(a.keys).toHaveLength(0)
    expect(b.keys).toHaveLength(1)
  })

  it('returns false when focusedIdx has no panel (the tab-index vs array-index gap)', () => {
    const a = new FakePanel({ row: 1, col: 0, height: 10, width: 40 })
    const router = new InputRouter()
    // Tabs 4 (Config) and 5 (Logs) don't exist in panels[] — router returns false
    expect(router.dispatch(key('x'), [a], 4)).toBe(false)
    expect(a.keys).toHaveLength(0)
  })

  it('propagates the panel consumed flag', () => {
    const a = new FakePanel({ row: 1, col: 0, height: 10, width: 40 }, false)
    const router = new InputRouter()
    expect(router.dispatch(key('x'), [a], 0)).toBe(false)
    expect(a.keys).toHaveLength(1)
  })
})

describe('InputRouter — mouse dispatch', () => {
  it('routes mouse to the panel whose rect contains the point, regardless of focus', () => {
    const a = new FakePanel({ row: 1, col: 0, height: 10, width: 40 })
    const b = new FakePanel({ row: 1, col: 40, height: 10, width: 40 })
    const router = new InputRouter()
    expect(router.dispatch(click(5, 50), [a, b], 0)).toBe(true)
    expect(a.mice).toHaveLength(0)
    expect(b.mice).toHaveLength(1)
  })

  it('first matching rect wins when rects overlap (declaration order)', () => {
    const a = new FakePanel({ row: 1, col: 0, height: 10, width: 80 })
    const b = new FakePanel({ row: 1, col: 0, height: 10, width: 80 })
    const router = new InputRouter()
    router.dispatch(click(5, 5), [a, b], 0)
    expect(a.mice).toHaveLength(1)
    expect(b.mice).toHaveLength(0)
  })

  it('returns false when no rect contains the point', () => {
    const a = new FakePanel({ row: 1, col: 0, height: 10, width: 40 })
    const router = new InputRouter()
    expect(router.dispatch(click(20, 70), [a], 0)).toBe(false)
  })
})
