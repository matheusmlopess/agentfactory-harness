import { describe, it, expect, beforeEach } from 'vitest'
import { OrchestrationCanvas, type CanvasSessionActions } from './panel.js'
import type { Block } from './Block.js'

const noop = () => {}

function makeCanvas(width = 80, height = 30): OrchestrationCanvas {
  const canvas = new OrchestrationCanvas(
    { row: 1, col: 40, height, width },
    noop
  )
  return canvas
}

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: 'b1',
    row: 2,
    col: 4,
    height: 5,
    width: 18,
    title: 'test-agent',
    status: 'idle',
    outputs: ['out'],
    inputs: ['in'],
    ...overrides,
  }
}

describe('OrchestrationCanvas', () => {
  let canvas: OrchestrationCanvas

  beforeEach(() => {
    canvas = makeCanvas()
    canvas.loadState({ blocks: [makeBlock()], wires: [], drag: { kind: 'idle' } })
  })

  it('getState returns the loaded state', () => {
    const state = canvas.getState()
    expect(state.blocks).toHaveLength(1)
    expect(state.blocks[0]?.id).toBe('b1')
  })

  it('starts drag on left-press on block header row', () => {
    // Block is at inner-relative row=2, col=4; inner starts at row+1=2, col+1=41
    // Canvas inner: row=2, col=41
    // Block header in canvas coords: row=2, col=4
    // Mouse event in terminal coords: row=2+2=4, col=41+4=45
    canvas.onMouse({ button: 'left', action: 'press', row: 4, col: 45, shift: false, ctrl: false, alt: false })
    expect(canvas.getState().drag.kind).toBe('dragging')
  })

  it('does not drag when clicking block body (not header)', () => {
    // Row 5 = block body row (row=2+1=3 in canvas, terminal row=2+3=5)
    canvas.onMouse({ button: 'left', action: 'press', row: 5, col: 45, shift: false, ctrl: false, alt: false })
    expect(canvas.getState().drag.kind).toBe('idle')
  })

  it('snaps block to grid on mouse release', () => {
    // Start drag on header
    canvas.onMouse({ button: 'left', action: 'press', row: 4, col: 45, shift: false, ctrl: false, alt: false })
    expect(canvas.getState().drag.kind).toBe('dragging')

    // Move to new position
    canvas.onMouse({ button: 'left', action: 'move', row: 7, col: 51, shift: false, ctrl: false, alt: false })

    // Release
    canvas.onMouse({ button: 'left', action: 'release', row: 7, col: 51, shift: false, ctrl: false, alt: false })

    const state = canvas.getState()
    expect(state.drag.kind).toBe('idle')
    const block = state.blocks[0]
    // Snapped to grid: divisible by GRID_ROWS=2 and GRID_COLS=4
    expect(block?.row ?? -1).toBeGreaterThanOrEqual(0)
    expect((block?.row ?? -1) % 2).toBe(0)
    expect((block?.col ?? -1) % 4).toBe(0)
  })

  it('adding a block via right-click context menu increases block count', () => {
    // Right-click on empty canvas area
    canvas.onMouse({ button: 'right', action: 'press', row: 10, col: 60, shift: false, ctrl: false, alt: false })
    // Simulate pressing enter on context menu (first item = "Add agent block")
    canvas.onKey({ key: 'enter', raw: Buffer.from('\r') })
    expect(canvas.getState().blocks).toHaveLength(2)
  })

  it('ignores clicks outside the panel rect', () => {
    // Click outside rect (row=0, which is before panel starts at row=1)
    const result = canvas.onMouse({ button: 'left', action: 'press', row: 0, col: 50, shift: false, ctrl: false, alt: false })
    expect(result).toBe(false)
  })
})

// ── Interactive wiring ───────────────────────────────────────────────────────
// Canvas rect: { row:1, col:40, height:30, width:100 }
// Inner:       { row:2, col:41, height:28, width:98 }
// b1: row=2, col=2, height=5, width=16
//   output ○ at canvas(3,17) → terminal(5,58)
//   input  ● at canvas(3, 2) → terminal(5,43)
// b2: row=2, col=26, height=5, width=16
//   output ○ at canvas(3,41) → terminal(5,82)
//   input  ● at canvas(3,26) → terminal(5,67)

function makeWiringCanvas(): OrchestrationCanvas {
  const canvas = new OrchestrationCanvas({ row: 1, col: 40, height: 30, width: 100 }, noop)
  canvas.loadState({
    blocks: [
      { id: 'b1', row: 2, col: 2,  height: 5, width: 16, title: 'agent-1', status: 'idle', outputs: ['out'], inputs: ['in'] },
      { id: 'b2', row: 2, col: 26, height: 5, width: 16, title: 'agent-2', status: 'idle', outputs: ['out'], inputs: ['in'] },
    ],
    wires: [],
    drag: { kind: 'idle' },
  })
  return canvas
}

const M = (row: number, col: number, button: 'left'|'right' = 'left', action: 'press'|'release'|'move' = 'press') =>
  ({ button, action, row, col, shift: false, ctrl: false, alt: false } as const)

/** Complete a wire b1→b2 and confirm the connector-type menu with Enter. */
function wire(c: OrchestrationCanvas, connectorNav = 0): void {
  c.onMouse(M(5, 58))    // start wiring from b1 output
  c.onMouse(M(5, 67))    // click b2 input ● → typed-connector menu opens
  for (let i = 0; i < connectorNav; i++) c.onKey({ key: 'arrow_down', raw: Buffer.from('\x1b[B') })
  c.onKey({ key: 'enter', raw: Buffer.from('\r') })
}

describe('OrchestrationCanvas — interactive wiring (typed connectors)', () => {
  it('clicking output port enters wiring state', () => {
    const c = makeWiringCanvas()
    c.onMouse(M(5, 58))     // b1 output ○ at terminal(5,58)
    expect(c.getState().drag.kind).toBe('wiring')
  })

  it('mouse move while wiring updates cursor', () => {
    const c = makeWiringCanvas()
    c.onMouse(M(5, 58))
    c.onMouse(M(5, 67, 'left', 'move'))
    const drag = c.getState().drag
    expect(drag.kind).toBe('wiring')
    if (drag.kind === 'wiring') {
      expect(drag.cursorRow).toBe(5 - 2)  // canvas-relative
      expect(drag.cursorCol).toBe(67 - 41)
    }
  })

  it('completing a wire opens the connector menu; Enter creates a dependency edge', () => {
    const c = makeWiringCanvas()
    wire(c)
    const state = c.getState()
    expect(state.drag.kind).toBe('idle')
    expect(state.wires).toHaveLength(1)
    expect(state.wires[0]).toMatchObject({ fromBlockId: 'b1', toBlockId: 'b2', kind: 'dependency' })
    expect(c.getModel().edges[0]).toMatchObject({ from: 'b1', to: 'b2', kind: 'dependency' })
  })

  it('second connector item creates a handoff edge with summary payload', () => {
    const c = makeWiringCanvas()
    wire(c, 1)  // arrow_down once → 'handoff: summary'
    expect(c.getState().wires[0]).toMatchObject({ kind: 'handoff', payload: 'summary' })
  })

  it('self-loop is rejected (no menu, no wire)', () => {
    const c = makeWiringCanvas()
    c.onMouse(M(5, 58))    // start wiring from b1 output
    c.onMouse(M(5, 43))    // click b1 input ● (same block)
    expect(c.getState().drag.kind).toBe('idle')
    expect(c.getState().wires).toHaveLength(0)
  })

  it('duplicate wire is rejected before the menu opens', () => {
    const c = makeWiringCanvas()
    wire(c)
    c.onMouse(M(5, 58)); c.onMouse(M(5, 67))   // attempt duplicate — no menu
    c.onKey({ key: 'enter', raw: Buffer.from('\r') })
    expect(c.getState().wires).toHaveLength(1)
  })

  it('clicking non-port while wiring cancels without creating wire', () => {
    const c = makeWiringCanvas()
    c.onMouse(M(5, 58))    // enter wiring
    c.onMouse(M(10, 50))   // click empty canvas area
    expect(c.getState().drag.kind).toBe('idle')
    expect(c.getState().wires).toHaveLength(0)
  })

  it('Esc cancels wiring', () => {
    const c = makeWiringCanvas()
    c.onMouse(M(5, 58))
    c.onKey({ key: 'escape', raw: Buffer.from('\x1b') })
    expect(c.getState().drag.kind).toBe('idle')
    expect(c.getState().wires).toHaveLength(0)
  })

  it('delete wire via right-click context menu', () => {
    const c = makeWiringCanvas()
    wire(c)
    expect(c.getState().wires).toHaveLength(1)
    // The wire runs from output(3,17) to input(3,26): horizontal mid at col ~21
    // At canvas(3,21) → terminal(5, 62) — on the wire path
    c.onMouse(M(5, 62, 'right'))
    // Menu should open with delete wire option
    c.onKey({ key: 'enter', raw: Buffer.from('\r') })
    expect(c.getState().wires).toHaveLength(0)
  })

  it('deleting a block also removes its wires', () => {
    const c = makeWiringCanvas()
    wire(c)
    expect(c.getState().wires).toHaveLength(1)
    // Right-click b1 header → delete block
    c.onMouse(M(4, 43, 'right'))  // b1 header at terminal(4,43)
    c.onKey({ key: 'arrow_down', raw: Buffer.from('\x1b[B') })  // select "Delete block"
    c.onKey({ key: 'enter', raw: Buffer.from('\r') })
    expect(c.getState().blocks.find(b => b.id === 'b1')).toBeUndefined()
    expect(c.getState().wires).toHaveLength(0)
  })
})

describe('OrchestrationCanvas — build mode (ownership inversion)', () => {
  it('the model is the source of truth: drag release writes back into it', () => {
    const c = makeWiringCanvas()
    c.onMouse(M(4, 43))                          // grab b1 header
    c.onMouse(M(8, 51, 'left', 'move'))
    c.onMouse(M(8, 51, 'left', 'release'))
    const node = c.getModel().nodes.find(n => n.id === 'b1')!
    expect(node.row % 2).toBe(0)
    expect(node.col % 4).toBe(0)
    expect(c.getState().blocks.find(b => b.id === 'b1')!.row).toBe(node.row)
  })

  it('body click selects a node; Esc deselects', () => {
    const c = makeWiringCanvas()
    c.onMouse(M(6, 45))                          // b1 body (not header)
    expect(c.selectedId).toBe('b1')
    c.onKey({ key: 'escape', raw: Buffer.from('\x1b') })
    expect(c.selectedId).toBeNull()
  })

  it('t toggles the toolbox; clicking an item enters placing mode; drop creates a real node', () => {
    const c = makeWiringCanvas()
    c.onKey({ key: 't', raw: Buffer.from('t') })
    c.onMouse(M(3, 42))                          // toolbox item 0 → 'generic' (canvas row 1, col 1)
    expect(c.getState().drag.kind).toBe('placing')
    c.onMouse(M(20, 80))                         // drop on empty canvas
    expect(c.getModel().nodes).toHaveLength(3)
    const added = c.getModel().nodes[2]!
    expect(added.agent).toBe('generic')
    // Dropping opens the inspector — Esc closes it
    c.onKey({ key: 'escape', raw: Buffer.from('\x1b') })
  })

  it('syncFromPlan keeps pending/skipped statuses distinct via applyStepEvent', () => {
    const c = makeWiringCanvas()
    c.applyStepEvent({ type: 'step:skipped', stepId: 'b2', status: 'skipped' })
    expect(c.getState().blocks.find(b => b.id === 'b2')!.status).toBe('skipped')
    c.applyStepEvent({ type: 'step:start', stepId: 'b1', status: 'running' })
    expect(c.getState().blocks.find(b => b.id === 'b1')!.status).toBe('running')
  })
})

// ── Session binding (canvas ↔ agents ↔ sessions integration) ────────────────

interface FakeActions extends CanvasSessionActions {
  created: string[]
  opened: string[]
  /** Scripted openSession result per call; default echoes the id back. */
  openResult?: (id: string) => string | null
}

function makeActions(sessions: { id: string; name: string; active: boolean }[] = []): FakeActions {
  const fake: FakeActions = {
    created: [],
    opened: [],
    listSessions: () => sessions,
    createSessionFor: (name) => {
      fake.created.push(name)
      return `sid-${name}`
    },
    openSession: (id) => {
      fake.opened.push(id)
      return fake.openResult ? fake.openResult(id) : id
    },
  }
  return fake
}

function makeBoundCanvas(actions: CanvasSessionActions | undefined): OrchestrationCanvas {
  const c = new OrchestrationCanvas({ row: 1, col: 40, height: 30, width: 100 }, noop, actions)
  c.loadState({
    blocks: [
      { id: 'b1', row: 2, col: 2,  height: 5, width: 16, title: 'agent-1', status: 'idle', outputs: ['out'], inputs: ['in'] },
    ],
    wires: [],
    drag: { kind: 'idle' },
  })
  return c
}

describe('OrchestrationCanvas — session binding', () => {
  it('addNode auto-creates and binds a session named after the node', () => {
    const actions = makeActions()
    const c = makeBoundCanvas(actions)
    c.onMouse(M(10, 60, 'right'))                       // empty canvas → menu
    c.onKey({ key: 'enter', raw: Buffer.from('\r') })   // "Add agent block"
    c.onKey({ key: 'escape', raw: Buffer.from('\x1b') }) // close inspector
    const added = c.getModel().nodes.find(n => n.id !== 'b1')!
    expect(actions.created).toEqual([added.id])
    expect(added.sessionId).toBe(`sid-${added.id}`)
  })

  it('addNode skips binding when no session actions are injected', () => {
    const c = makeBoundCanvas(undefined)
    c.onMouse(M(10, 60, 'right'))
    c.onKey({ key: 'enter', raw: Buffer.from('\r') })
    c.onKey({ key: 'escape', raw: Buffer.from('\x1b') })
    const added = c.getModel().nodes.find(n => n.id !== 'b1')!
    expect(added.sessionId).toBeUndefined()
  })

  it('bindSession writes to and unbind clears the model', () => {
    const c = makeBoundCanvas(makeActions())
    c.bindSession('b1', 'sid-x')
    expect(c.getModel().nodes[0]!.sessionId).toBe('sid-x')
    c.bindSession('b1', undefined)
    expect(c.getModel().nodes[0]!.sessionId).toBeUndefined()
  })

  it("'o' on a selected node opens its bound session", () => {
    const actions = makeActions()
    const c = makeBoundCanvas(actions)
    c.bindSession('b1', 'sid-live')
    c.onMouse(M(6, 45))                                  // select b1 body
    c.onKey({ key: 'o', raw: Buffer.from('o') })
    expect(actions.opened).toEqual(['sid-live'])
  })

  it('opening an unbound node creates a session and binds it', () => {
    const actions = makeActions()
    const c = makeBoundCanvas(actions)
    c.openNodeSession('b1')
    expect(actions.created).toEqual(['b1'])
    expect(actions.opened).toEqual(['sid-b1'])
    expect(c.getModel().nodes[0]!.sessionId).toBe('sid-b1')
  })

  it('a dangling binding is replaced by a fresh session on open', () => {
    const actions = makeActions()
    actions.openResult = (id) => (id === 'sid-dead' ? null : id)
    const c = makeBoundCanvas(actions)
    c.bindSession('b1', 'sid-dead')
    c.openNodeSession('b1')
    expect(actions.opened).toEqual(['sid-dead', 'sid-b1'])
    expect(c.getModel().nodes[0]!.sessionId).toBe('sid-b1')
  })

  it('a resumed session (new id) rebinds the node to the fresh id', () => {
    const actions = makeActions()
    actions.openResult = (id) => (id === 'sid-old' ? 'sid-resumed' : id)
    const c = makeBoundCanvas(actions)
    c.bindSession('b1', 'sid-old')
    c.openNodeSession('b1')
    expect(c.getModel().nodes[0]!.sessionId).toBe('sid-resumed')
  })

  it('block context menu offers Open session, and Bind session… binds a listed session', () => {
    const actions = makeActions([
      { id: 'sid-einstein', name: 'Einstein', active: true },
      { id: 'sid-curie',    name: 'Curie',    active: false },
    ])
    const c = makeBoundCanvas(actions)
    // Right-click b1 body → menu: Configure… / Open session / Bind session… / Delete block
    c.onMouse(M(6, 45, 'right'))
    c.onKey({ key: 'arrow_down', raw: Buffer.from('\x1b[B') })   // → Open session
    c.onKey({ key: 'enter', raw: Buffer.from('\r') })
    expect(actions.created).toEqual(['b1'])                      // unbound → created + opened
    expect(actions.opened).toEqual(['sid-b1'])

    // Again: Bind session… → pick the second session (Curie)
    c.onMouse(M(6, 45, 'right'))
    c.onKey({ key: 'arrow_down', raw: Buffer.from('\x1b[B') })
    c.onKey({ key: 'arrow_down', raw: Buffer.from('\x1b[B') })   // → Bind session…
    c.onKey({ key: 'enter', raw: Buffer.from('\r') })
    c.onKey({ key: 'arrow_down', raw: Buffer.from('\x1b[B') })   // → · Curie
    c.onKey({ key: 'enter', raw: Buffer.from('\r') })
    expect(c.getModel().nodes[0]!.sessionId).toBe('sid-curie')
  })

  it('the menu omits session items when no actions are injected', () => {
    const c = makeBoundCanvas(undefined)
    c.onMouse(M(6, 45, 'right'))
    // Items: Configure… / Delete block → arrow_down once reaches Delete block
    c.onKey({ key: 'arrow_down', raw: Buffer.from('\x1b[B') })
    c.onKey({ key: 'enter', raw: Buffer.from('\r') })
    expect(c.getModel().nodes).toHaveLength(0)                   // b1 deleted
  })
})
