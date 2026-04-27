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
