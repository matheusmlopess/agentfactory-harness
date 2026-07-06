/**
 * InputRouter tests — updated in the P3 commit that replaced the
 * panels[]-index contract with TabEntry routing (all six tabs first-class).
 * The old contract returned false for Config (4) / Logs (5); the new one
 * routes them like any other tab.
 */
import { describe, it, expect } from 'vitest'
import { InputRouter } from './router.js'
import { Panel } from '../panels/Panel.js'
import type { TabEntry, TabId } from '../tabs.js'
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

function tab(id: TabId, panel: Panel, opts: { capture?: boolean; visible?: (a: TabId) => boolean } = {}): TabEntry {
  return {
    id,
    title: id,
    captureMouse: opts.capture ?? false,
    panel: () => panel,
    rectFor: () => panel.rect,
    hitVisible: opts.visible ?? (() => true),
  }
}

describe('InputRouter — key dispatch', () => {
  it('routes keys to the active tab panel — Config and Logs are first-class now', () => {
    const session = new FakePanel({ row: 1, col: 0, height: 10, width: 40 })
    const config = new FakePanel({ row: 1, col: 40, height: 10, width: 40 })
    const tabs = [tab('session', session), tab('config', config, { capture: true })]
    const router = new InputRouter()
    expect(router.dispatchKey(key('x'), tabs, 'config')).toBe(true)
    expect(session.keys).toHaveLength(0)
    expect(config.keys).toHaveLength(1)
  })

  it('returns false for an unknown active tab', () => {
    const router = new InputRouter()
    expect(router.dispatchKey(key('x'), [], 'logs')).toBe(false)
  })

  it('propagates the panel consumed flag', () => {
    const p = new FakePanel({ row: 1, col: 0, height: 10, width: 40 }, false)
    const router = new InputRouter()
    expect(router.dispatchKey(key('x'), [tab('session', p)], 'session')).toBe(false)
    expect(p.keys).toHaveLength(1)
  })
})

describe('InputRouter — mouse dispatch', () => {
  it('routes mouse to the hit-visible panel containing the point', () => {
    const a = new FakePanel({ row: 1, col: 0, height: 10, width: 40 })
    const b = new FakePanel({ row: 1, col: 40, height: 10, width: 40 })
    const tabs = [tab('session', a), tab('orchestration', b)]
    const router = new InputRouter()
    expect(router.dispatchMouse(click(5, 50), tabs, 'session')).toBe(true)
    expect(a.mice).toHaveLength(0)
    expect(b.mice).toHaveLength(1)
  })

  it('skips capture-mode tabs (controller handles those) and invisible tabs', () => {
    const logs = new FakePanel({ row: 1, col: 0, height: 10, width: 80 })
    const terminal = new FakePanel({ row: 1, col: 0, height: 10, width: 80 })
    const tabs = [
      tab('logs', logs, { capture: true }),
      tab('terminal', terminal, { visible: a => a === 'terminal' }),
    ]
    const router = new InputRouter()
    expect(router.dispatchMouse(click(5, 5), tabs, 'session')).toBe(false)
    expect(logs.mice).toHaveLength(0)
    expect(terminal.mice).toHaveLength(0)
  })

  it('first matching visible rect wins on overlap (declaration order)', () => {
    const a = new FakePanel({ row: 1, col: 0, height: 10, width: 80 })
    const b = new FakePanel({ row: 1, col: 0, height: 10, width: 80 })
    const router = new InputRouter()
    router.dispatchMouse(click(5, 5), [tab('session', a), tab('agents', b)], 'session')
    expect(a.mice).toHaveLength(1)
    expect(b.mice).toHaveLength(0)
  })
})

describe('InputRouter — click-to-focus (panelTabAt semantics)', () => {
  it('reproduces the historical visibility branches', () => {
    const session = new FakePanel({ row: 1, col: 0, height: 22, width: 32 })
    const canvas = new FakePanel({ row: 1, col: 32, height: 15, width: 48 })
    const agents = new FakePanel({ row: 16, col: 32, height: 7, width: 48 })
    const config = new FakePanel({ row: 1, col: 32, height: 22, width: 48 })
    const tabs = [
      tab('session', session),
      tab('orchestration', canvas, { visible: a => a !== 'config' && a !== 'terminal' }),
      tab('agents', agents, { visible: a => a !== 'config' && a !== 'terminal' }),
      tab('config', config, { capture: true, visible: a => a === 'config' }),
    ]
    const router = new InputRouter()
    // On session tab: right column hits canvas/agents
    expect(router.tabAt(5, 50, tabs, 'session')).toBe('orchestration')
    expect(router.tabAt(20, 50, tabs, 'session')).toBe('agents')
    // On config tab: right column hits config, canvas/agents are shadowed
    expect(router.tabAt(5, 50, tabs, 'config')).toBe('config')
    // Session column always wins on the left
    expect(router.tabAt(5, 5, tabs, 'config')).toBe('session')
    // Outside all rects
    expect(router.tabAt(23, 79, tabs, 'session')).toBeNull()
  })
})
