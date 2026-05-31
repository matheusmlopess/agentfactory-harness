import { describe, it, expect, beforeEach } from 'vitest'
import { OrchestrationCanvas } from './OrchestrationCanvas.js'
import type { Block } from '../widgets/Block.js'

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

describe('OrchestrationCanvas — interactive wiring', () => {
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

  it('clicking input port of another block creates wire and returns to idle', () => {
    const c = makeWiringCanvas()
    c.onMouse(M(5, 58))    // start wiring from b1 output
    c.onMouse(M(5, 67))    // click b2 input ●
    const state = c.getState()
    expect(state.drag.kind).toBe('idle')
    expect(state.wires).toHaveLength(1)
    expect(state.wires[0]?.fromBlockId).toBe('b1')
    expect(state.wires[0]?.toBlockId).toBe('b2')
  })

  it('self-loop is rejected', () => {
    const c = makeWiringCanvas()
    c.onMouse(M(5, 58))    // start wiring from b1 output
    c.onMouse(M(5, 43))    // click b1 input ● (same block)
    expect(c.getState().drag.kind).toBe('idle')
    expect(c.getState().wires).toHaveLength(0)
  })

  it('duplicate wire is rejected', () => {
    const c = makeWiringCanvas()
    c.onMouse(M(5, 58)); c.onMouse(M(5, 67))   // create b1→b2
    c.onMouse(M(5, 58)); c.onMouse(M(5, 67))   // attempt duplicate
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
    // Create a wire first
    c.onMouse(M(5, 58)); c.onMouse(M(5, 67))
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
    c.onMouse(M(5, 58)); c.onMouse(M(5, 67))   // b1→b2 wire
    expect(c.getState().wires).toHaveLength(1)
    // Right-click b1 header → delete block
    c.onMouse(M(4, 43, 'right'))  // b1 header at terminal(4,43)
    c.onKey({ key: 'arrow_down', raw: Buffer.from('\x1b[B') })  // select "Delete block"
    c.onKey({ key: 'enter', raw: Buffer.from('\r') })
    expect(c.getState().blocks.find(b => b.id === 'b1')).toBeUndefined()
    expect(c.getState().wires).toHaveLength(0)
  })
})
