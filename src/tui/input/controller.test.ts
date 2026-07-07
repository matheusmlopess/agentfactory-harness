/**
 * InputController tests — feed raw byte buffers into handleData() with a stub
 * host (no TTY). The terminal-bypass byte table mirrors terminal-bypass.test.ts
 * but exercises the REAL extracted state machine (the P3 gate).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InputController, type ControllerHost } from './controller.js'
import { InputRouter } from './router.js'
import { Keymap } from './keymap.js'
import { Panel } from '../panels/Panel.js'
import { computeLayout } from '../renderer/layout.js'
import { tabIdAt, tabIndex, type TabEntry, type TabId } from '../tabs.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { KeyEvent } from './keyboard.js'
import type { MouseEvent } from './mouse.js'

class FakePanel extends Panel {
  keys: KeyEvent[] = []
  mice: MouseEvent[] = []
  consume = true
  override render(_buf: CellBuffer): void {}
  override onKey(e: KeyEvent): boolean { this.keys.push(e); return this.consume }
  override onMouse(e: MouseEvent): boolean { this.mice.push(e); return this.consume }
}

interface Stub {
  controller: InputController
  host: ControllerHost
  panels: Record<TabId, FakePanel>
  active: { id: TabId }
  calls: {
    stop: ReturnType<typeof vi.fn>
    render: ReturnType<typeof vi.fn>
    runPlan: ReturnType<typeof vi.fn>
    toggleMouse: ReturnType<typeof vi.fn>
    ptyWrite: ReturnType<typeof vi.fn>
    scrollBack: ReturnType<typeof vi.fn>
    scrollForward: ReturnType<typeof vi.fn>
    openNewSessionMenu: ReturnType<typeof vi.fn>
    openModelPicker: ReturnType<typeof vi.fn>
    toggleChatMode: ReturnType<typeof vi.fn>
  }
  paletteOpen: { value: boolean }
  hits: Map<string, string>
}

function makeStub(activeId: TabId = 'session'): Stub {
  const ids: TabId[] = ['session', 'orchestration', 'agents', 'terminal', 'config', 'logs']
  const panels = Object.fromEntries(ids.map(id => [id, new FakePanel({ row: 1, col: 0, height: 22, width: 80 })])) as Record<TabId, FakePanel>
  // Give right-column panels distinct rects for scan tests
  panels.session.rect       = { row: 1, col: 0, height: 22, width: 32 }
  panels.orchestration.rect = { row: 1, col: 32, height: 15, width: 48 }
  panels.agents.rect        = { row: 16, col: 32, height: 7, width: 48 }
  panels.config.rect        = { row: 1, col: 32, height: 22, width: 48 }
  panels.logs.rect          = { row: 1, col: 0, height: 22, width: 80 }

  const tabs: TabEntry[] = [
    { id: 'session',       title: 'Session',       captureMouse: false, panel: () => panels.session,       rectFor: l => l.session,  hitVisible: () => true },
    { id: 'orchestration', title: 'Orchestration', captureMouse: false, panel: () => panels.orchestration, rectFor: l => l.canvas,   hitVisible: a => a !== 'config' && a !== 'terminal' },
    { id: 'agents',        title: 'Agents',        captureMouse: false, panel: () => panels.agents,        rectFor: l => l.agents,   hitVisible: a => a !== 'config' && a !== 'terminal' },
    { id: 'terminal',      title: 'Terminal',      captureMouse: false, panel: () => panels.terminal,      rectFor: l => l.terminal, hitVisible: a => a === 'terminal' },
    { id: 'config',        title: 'Config',        captureMouse: true,  panel: () => panels.config,        rectFor: l => l.config,   hitVisible: a => a === 'config' },
    { id: 'logs',          title: 'Logs',          captureMouse: true,  panel: () => panels.logs,          rectFor: l => l.logs,     hitVisible: () => false },
  ]

  const active = { id: activeId }
  const paletteOpen = { value: false }
  const hits = new Map<string, string>()
  const calls = {
    stop: vi.fn(), render: vi.fn(), runPlan: vi.fn(), toggleMouse: vi.fn(),
    ptyWrite: vi.fn(), scrollBack: vi.fn(), scrollForward: vi.fn(),
    openNewSessionMenu: vi.fn(), openModelPicker: vi.fn(), toggleChatMode: vi.fn(),
  }

  const palette = {
    isOpen: false,
    openPalette: vi.fn(),
    onKey: vi.fn(),
    onMouse: vi.fn(),
  }

  const host: ControllerHost = {
    dims: () => ({ rows: 24, cols: 80 }),
    tabs: () => tabs,
    activeTab: () => active.id,
    setActiveTab: (id) => { active.id = id },
    hitAt: (row, col) => hits.get(`${row},${col}`) ?? null,
    // Cast: the stub palette implements the subset the controller touches
    palette: palette as unknown as ControllerHost['palette'],
    isPaletteOpen: () => paletteOpen.value,
    setPaletteOpen: (open) => { paletteOpen.value = open },
    help: { isOpen: () => false, onKey: () => false, onMouse: () => false },
    textInputActive: () => active.id === 'session',
    layoutOf: (id) => {
      const tab = tabs.find(t => t.id === id)!
      return tab.rectFor(computeLayout(24, 80))
    },
    terminal: () => ({ write: calls.ptyWrite, scrollBack: calls.scrollBack, scrollForward: calls.scrollForward }),
    session: {
      openNewSessionMenu: calls.openNewSessionMenu,
      openModelPicker: calls.openModelPicker,
      toggleChatMode: calls.toggleChatMode,
      hasSelection: () => false,
      copySelection: vi.fn(),
      clearSelection: vi.fn(),
    },
    dragDivider: vi.fn(),
    stop: calls.stop,
    render: calls.render,
  }

  // Mirror the app's global bindings so global-key behavior stays covered
  const keymap = new Keymap()
  const switchTo = (id: TabId, key: string) => ({
    id: `tab.${id}`, keys: [key], description: id,
    run: () => {
      if (id === 'session' && active.id === 'session') calls.openNewSessionMenu()
      active.id = id
      calls.render()
    },
  })
  keymap.add([
    { id: 'app.quit', keys: ['ctrl+q'], description: 'Quit', run: calls.stop },
    { id: 'app.copyOrQuit', keys: ['ctrl+c'], description: 'Copy/quit', run: calls.stop },
    { id: 'app.selectCopy', keys: ['ctrl+e'], description: 'Select', run: calls.toggleMouse },
    { id: 'app.nextTab', keys: ['tab'], description: 'Next tab', run: () => { active.id = tabIdAt(tabIndex(active.id) + 1); calls.render() } },
    switchTo('session', 'f1'), switchTo('orchestration', 'f2'), switchTo('agents', 'f3'),
    switchTo('terminal', 'f4'), switchTo('config', 'f5'), switchTo('logs', 'f6'),
    { id: 'plan.run', keys: ['ctrl+r'], description: 'Run plan', panelFirst: true, run: calls.runPlan },
  ])

  return { controller: new InputController(host, new InputRouter(), keymap), host, panels, active, calls, paletteOpen, hits }
}

const raw = (s: string): Buffer => Buffer.from(s, 'binary')

describe('terminal tab raw bypass (byte table against the real state machine)', () => {
  let s: Stub
  beforeEach(() => { s = makeStub('terminal') })

  it('Ctrl+Q (0x11) → stop', () => {
    s.controller.handleData(Buffer.from([0x11]))
    expect(s.calls.stop).toHaveBeenCalledOnce()
  })

  it('Ctrl+P (0x10) → palette toggle, never PTY', () => {
    s.controller.handleData(Buffer.from([0x10]))
    expect(s.paletteOpen.value).toBe(true)
    expect(s.calls.ptyWrite).not.toHaveBeenCalled()
  })

  it.each([
    ['\x1bOP', 'session'], ['\x1b[11~', 'session'],
    ['\x1bOQ', 'orchestration'], ['\x1b[12~', 'orchestration'],
    ['\x1bOR', 'agents'], ['\x1b[13~', 'agents'],
    ['\x1b[15~', 'config'],
  ] as const)('F-key %s switches to %s', (bytes, target) => {
    s.controller.handleData(raw(bytes))
    expect(s.active.id).toBe(target)
    expect(s.calls.ptyWrite).not.toHaveBeenCalled()
  })

  it('F4 is a no-op (already on Terminal)', () => {
    s.controller.handleData(raw('\x1bOS'))
    expect(s.active.id).toBe('terminal')
    expect(s.calls.ptyWrite).not.toHaveBeenCalled()
  })

  it('Shift+PgUp/PgDn scroll the terminal scrollback', () => {
    s.controller.handleData(raw('\x1b[5;2~'))
    expect(s.calls.scrollBack).toHaveBeenCalledOnce()
    s.controller.handleData(raw('\x1b[6;2~'))
    expect(s.calls.scrollForward).toHaveBeenCalledOnce()
  })

  it('SGR mouse is suppressed from the PTY; tab-bar click switches tabs', () => {
    // A click in the panel body — suppressed entirely
    s.controller.handleData(raw('\x1b[<0;10;10M'))
    expect(s.calls.ptyWrite).not.toHaveBeenCalled()
    // A click on tab 0 (row 0) — hitAt reports the zone
    s.hits.set('0,2', 'tab:0')
    s.controller.handleData(raw('\x1b[<0;3;1M'))  // SGR is 1-based: col 3, row 1 → (0-based row 0, col 2)
    expect(s.active.id).toBe('session')
  })

  it('exit button click in terminal mode stops the app', () => {
    s.hits.set('0,75', 'exit-btn')
    s.controller.handleData(raw('\x1b[<0;76;1M'))
    expect(s.calls.stop).toHaveBeenCalledOnce()
  })

  it('plain printable bytes pass through to the PTY', () => {
    s.controller.handleData(raw('a'))
    expect(s.calls.ptyWrite).toHaveBeenCalledOnce()
    s.controller.handleData(Buffer.from([0x09]))  // Tab
    s.controller.handleData(Buffer.from([0x0d]))  // Enter
    expect(s.calls.ptyWrite).toHaveBeenCalledTimes(3)
  })
})

describe('global keys (non-terminal)', () => {
  it('ctrl+q stops; ctrl+e toggles mouse; ctrl+r runs the plan when unconsumed', () => {
    const s = makeStub('session')
    s.controller.handleData(Buffer.from([0x11]))  // ctrl+q raw
    expect(s.calls.stop).toHaveBeenCalledOnce()
    s.controller.handleData(Buffer.from([0x05]))  // ctrl+e
    expect(s.calls.toggleMouse).toHaveBeenCalledOnce()
    s.panels.session.consume = false
    s.controller.handleData(Buffer.from([0x12]))  // ctrl+r
    expect(s.calls.runPlan).toHaveBeenCalledOnce()
  })

  it('ctrl+r is consumed by the active panel first (Config clear-key behaviour)', () => {
    const s = makeStub('config')
    s.panels.config.consume = true
    s.controller.handleData(Buffer.from([0x12]))
    expect(s.panels.config.keys).toHaveLength(1)
    expect(s.calls.runPlan).not.toHaveBeenCalled()
  })

  it('Tab cycles tabs until Terminal, where Tab becomes a PTY byte', () => {
    const s = makeStub('session')
    const seen: TabId[] = []
    for (let i = 0; i < 3; i++) {
      s.controller.handleData(Buffer.from([0x09]))
      seen.push(s.active.id)
    }
    expect(seen).toEqual(['orchestration', 'agents', 'terminal'])
    // On Terminal, Tab passes through to the shell instead of cycling
    s.controller.handleData(Buffer.from([0x09]))
    expect(s.active.id).toBe('terminal')
    expect(s.calls.ptyWrite).toHaveBeenCalledOnce()
  })

  it('Tab cycles config → logs → session (starting from config)', () => {
    const s = makeStub('config')
    s.controller.handleData(Buffer.from([0x09]))
    expect(s.active.id).toBe('logs')
    s.controller.handleData(Buffer.from([0x09]))
    expect(s.active.id).toBe('session')
  })

  it('F6 reaches Logs and keys then route to the logs panel (was explicit dispatch)', () => {
    const s = makeStub('session')
    s.controller.handleData(raw('\x1b[17~'))  // F6
    expect(s.active.id).toBe('logs')
    s.controller.handleData(raw('j'))
    expect(s.panels.logs.keys.map(k => k.key)).toEqual(['j'])
  })

  it('F1 while on session opens the new-session menu', () => {
    const s = makeStub('session')
    s.controller.handleData(raw('\x1bOP'))
    expect(s.calls.openNewSessionMenu).toHaveBeenCalledOnce()
    expect(s.active.id).toBe('session')
  })
})

describe('mouse routing (non-terminal)', () => {
  it('status-bar model zone opens the model picker', () => {
    const s = makeStub('orchestration')
    s.hits.set('23,10', 'statusbar:model')
    s.controller.handleData(raw('\x1b[<0;11;24M'))
    expect(s.calls.openModelPicker).toHaveBeenCalledOnce()
    expect(s.active.id).toBe('session')
  })

  it('capture tab (config) receives all mouse events incl. wheel', () => {
    const s = makeStub('config')
    s.controller.handleData(raw('\x1b[<64;10;10M'))  // wheel up anywhere
    expect(s.panels.config.mice).toHaveLength(1)
    expect(s.calls.render).toHaveBeenCalled()
  })

  it('body click on another panel switches focus then dispatches by rect', () => {
    const s = makeStub('session')
    s.controller.handleData(raw('\x1b[<0;40;10M'))  // col 39, row 9 → canvas rect
    expect(s.active.id).toBe('orchestration')
    expect(s.panels.orchestration.mice).toHaveLength(1)
  })

  it('shift+click passes through for native selection', () => {
    const s = makeStub('session')
    s.controller.handleData(raw('\x1b[<4;10;10M'))  // shift bit set
    expect(s.panels.session.mice).toHaveLength(0)
  })
})
