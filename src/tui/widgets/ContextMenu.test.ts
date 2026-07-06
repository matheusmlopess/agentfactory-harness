import { describe, it, expect, vi } from 'vitest'
import { ContextMenu, type MenuItem } from './ContextMenu.js'
import { CellBuffer } from '../renderer/cell-buffer.js'
import type { MouseEvent } from '../input/mouse.js'

const click = (row: number, col: number): MouseEvent =>
  ({ button: 'left', action: 'press', row, col, shift: false, ctrl: false, alt: false })

function makeMenu(): { menu: ContextMenu; actions: ReturnType<typeof vi.fn>[]; onDismiss: ReturnType<typeof vi.fn> } {
  const actions = [vi.fn(), vi.fn()]
  const items: MenuItem[] = [
    { label: 'Open', action: actions[0]! },
    { label: 'Delete', action: actions[1]!, danger: true },
  ]
  const onDismiss = vi.fn()
  const menu = new ContextMenu(5, 10, items, onDismiss)
  menu.render(new CellBuffer(30, 60), 30, 60)  // establish geometry
  return { menu, actions, onDismiss }
}

describe('ContextMenu — keyboard', () => {
  it('arrows move selection, Enter activates', () => {
    const { menu, actions } = makeMenu()
    expect(menu.onKey({ key: 'arrow_down', raw: Buffer.from('') })).toBe(true)
    expect(menu.onKey({ key: 'enter', raw: Buffer.from('\r') })).toBe(true)
    expect(actions[1]).toHaveBeenCalledOnce()
  })

  it('Escape dismisses (gap 4 fix — was host-only before)', () => {
    const { menu, onDismiss } = makeMenu()
    expect(menu.onKey({ key: 'escape', raw: Buffer.from('\x1b') })).toBe(true)
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})

describe('ContextMenu — mouse (gap 4 fix — had no mouse handling before)', () => {
  it('click on an item activates it', () => {
    const { menu, actions } = makeMenu()
    // items render at menu row+1+i → rows 6 and 7
    expect(menu.onMouse(click(7, 12))).toBe(true)
    expect(actions[1]).toHaveBeenCalledOnce()
  })

  it('click outside dismisses', () => {
    const { menu, actions, onDismiss } = makeMenu()
    expect(menu.onMouse(click(20, 40))).toBe(true)
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(actions[0]).not.toHaveBeenCalled()
  })

  it('click on the border dismisses (not an item)', () => {
    const { menu, onDismiss } = makeMenu()
    expect(menu.onMouse(click(5, 12))).toBe(true)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('non-press events are not handled', () => {
    const { menu } = makeMenu()
    expect(menu.onMouse({ ...click(7, 12), action: 'release' })).toBe(false)
  })
})

describe('ContextMenu — render', () => {
  it('draws a bordered box with labels', () => {
    const { menu } = makeMenu()
    const buf = new CellBuffer(30, 60)
    menu.render(buf, 30, 60)
    const plain = buf.diff(new CellBuffer(30, 60)).replace(/\x1b\[[^m]*m|\x1b\[\d+;\d+H/g, '')
    expect(plain).toContain('┌')
    expect(plain).toContain('Open')
    expect(plain).toContain('Delete')
  })
})
