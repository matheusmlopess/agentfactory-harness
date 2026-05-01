import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { KeyEvent } from '../input/keyboard.js'
import type { MouseEvent } from '../input/mouse.js'
import type { Rect } from '../renderer/layout.js'
import { Colors, Wire as WireChars } from '../renderer/theme.js'
import { type Block, renderBlock } from '../widgets/Block.js'
import { routeWire } from '../widgets/Wire.js'
import { ContextMenu } from '../widgets/ContextMenu.js'
import type { Plan } from '../../orchestration/schema.js'
import type { StepEvent } from '../../orchestration/executor.js'

export interface CanvasWire {
  id: string
  fromBlockId: string
  fromPort: string
  toBlockId: string
  toPort: string
}

type DragState =
  | { kind: 'idle' }
  | { kind: 'dragging'; blockId: string; offsetRow: number; offsetCol: number }

export interface CanvasState {
  blocks: Block[]
  wires: CanvasWire[]
  drag: DragState
}

const GRID_ROWS = 2
const GRID_COLS = 4

export class OrchestrationCanvas extends Panel {
  private state: CanvasState = { blocks: [], wires: [], drag: { kind: 'idle' } }
  private menu: ContextMenu | null = null
  private onUpdate: () => void

  constructor(rect: Rect, onUpdate: () => void) {
    super(rect)
    this.onUpdate = onUpdate
  }

  loadState(state: CanvasState): void {
    this.state = state
  }

  getState(): CanvasState {
    return this.state
  }

  /** Populate canvas blocks and wires from an af-plan.json Plan. */
  syncFromPlan(plan: Plan): void {
    const BLOCK_W = 20
    const BLOCK_H = 5
    const COL_STRIDE = 26
    const ROW_STRIDE = 8

    const blocks: Block[] = plan.steps.map((step, i) => ({
      id: step.id,
      row: Math.floor(i / 4) * ROW_STRIDE,
      col: (i % 4) * COL_STRIDE,
      height: BLOCK_H,
      width: BLOCK_W,
      title: step.agent,
      status: 'idle' as const,
      outputs: ['out'],
      inputs: step.dependsOn.length > 0 ? ['in'] : [],
    }))

    const wires: CanvasWire[] = []
    for (const step of plan.steps) {
      for (const dep of step.dependsOn) {
        wires.push({
          id: `${dep}→${step.id}`,
          fromBlockId: dep,
          fromPort: 'out',
          toBlockId: step.id,
          toPort: 'in',
        })
      }
    }

    this.state = { blocks, wires, drag: { kind: 'idle' } }
    this.onUpdate()
  }

  /** Update a block's status from an executor StepEvent. */
  applyStepEvent(event: StepEvent): void {
    if (event.type === 'plan:done') return
    const statusMap: Record<string, Block['status']> = {
      running: 'running',
      done: 'done',
      error: 'error',
      skipped: 'idle',
      pending: 'idle',
    }
    const blockStatus = statusMap[event.status] ?? 'idle'
    this.state = {
      ...this.state,
      blocks: this.state.blocks.map((b) =>
        b.id === event.stepId ? { ...b, status: blockStatus } : b,
      ),
    }
    this.onUpdate()
  }

  render(buf: CellBuffer): void {
    const r = this.inner
    buf.fill(r.row, r.col, r.height, r.width, ' ', { bg: Colors.bgPanel })

    // Draw grid dots
    for (let row = 0; row < r.height; row += GRID_ROWS) {
      for (let col = 0; col < r.width; col += GRID_COLS) {
        buf.write(r.row + row, r.col + col, '·', { fg: Colors.bgActive })
      }
    }

    // Draw wires
    for (const wire of this.state.wires) {
      const from = this.portPosition(wire.fromBlockId, wire.fromPort, 'output')
      const to   = this.portPosition(wire.toBlockId,   wire.toPort,   'input')
      if (!from || !to) continue
      for (const pt of routeWire(from, to)) {
        if (pt.row >= 0 && pt.row < r.height && pt.col >= 0 && pt.col < r.width) {
          buf.write(r.row + pt.row, r.col + pt.col, pt.char, { fg: Colors.accent })
        }
      }
    }

    // Draw blocks
    const drag = this.state.drag
    for (const block of this.state.blocks) {
      const isDragged = drag.kind === 'dragging' && drag.blockId === block.id
      renderBlock(buf, block, block.id === this.focusedBlockId(), r.row, r.col, isDragged)

      // Ghost at drag position
      if (isDragged) {
        const ghostRow = this.ghostRow
        const ghostCol = this.ghostCol
        if (ghostRow !== null && ghostCol !== null) {
          const ghost: Block = { ...block, row: ghostRow, col: ghostCol }
          renderBlock(buf, ghost, false, r.row, r.col, false)
        }
      }
    }

    // Draw context menu on top
    if (this.menu) {
      this.menu.render(buf, r.height, r.width)
    }
  }

  onKey(e: KeyEvent): boolean {
    if (this.menu) {
      if (e.key === 'escape') {
        this.menu = null
        this.onUpdate()
        return true
      }
      return this.menu.onKey(e)
    }
    return false
  }

  onMouse(e: MouseEvent): boolean {
    const r = this.inner
    // Convert to canvas-relative coords
    const canvasRow = e.row - r.row
    const canvasCol = e.col - r.col

    if (canvasRow < 0 || canvasRow >= r.height || canvasCol < 0 || canvasCol >= r.width) {
      return false
    }

    // Close menu on any click — consume the event so it doesn't also start a drag
    if (this.menu && e.action === 'press') {
      this.menu = null
      this.onUpdate()
      return true
    }

    if (e.button === 'right' && e.action === 'press') {
      this.openContextMenu(canvasRow, canvasCol)
      return true
    }

    if (e.button === 'left') {
      if (e.action === 'press') return this.handleLeftPress(canvasRow, canvasCol)
      if (e.action === 'move')  return this.handleMouseMove(canvasRow, canvasCol)
      if (e.action === 'release') return this.handleLeftRelease(canvasRow, canvasCol)
    }

    return false
  }

  private ghostRow: number | null = null
  private ghostCol: number | null = null

  private handleLeftPress(row: number, col: number): boolean {
    const block = this.hitTestHeader(row, col)
    if (!block) return false

    this.state = {
      ...this.state,
      drag: {
        kind: 'dragging',
        blockId: block.id,
        offsetRow: row - block.row,
        offsetCol: col - block.col,
      },
    }
    this.ghostRow = block.row
    this.ghostCol = block.col
    this.onUpdate()
    return true
  }

  private handleMouseMove(row: number, col: number): boolean {
    if (this.state.drag.kind !== 'dragging') return false
    const drag = this.state.drag
    this.ghostRow = row - drag.offsetRow
    this.ghostCol = col - drag.offsetCol
    this.onUpdate()
    return true
  }

  private handleLeftRelease(row: number, col: number): boolean {
    if (this.state.drag.kind !== 'dragging') return false
    const drag = this.state.drag

    const rawRow = row - drag.offsetRow
    const rawCol = col - drag.offsetCol
    const snappedRow = Math.max(0, Math.round(rawRow / GRID_ROWS) * GRID_ROWS)
    const snappedCol = Math.max(0, Math.round(rawCol / GRID_COLS) * GRID_COLS)

    this.state = {
      ...this.state,
      blocks: this.state.blocks.map(b =>
        b.id === drag.blockId
          ? { ...b, row: snappedRow, col: snappedCol }
          : b
      ),
      drag: { kind: 'idle' },
    }
    this.ghostRow = null
    this.ghostCol = null
    this.onUpdate()
    return true
  }

  private openContextMenu(row: number, col: number): void {
    const block = this.hitTestBlock(row, col)
    const r = this.inner

    const items = block
      ? [
          { label: 'Open session', action: () => { this.menu = null; this.onUpdate() } },
          { label: 'Delete block', danger: true, action: () => {
            this.state = { ...this.state, blocks: this.state.blocks.filter(b => b.id !== block.id) }
            this.menu = null
            this.onUpdate()
          }},
        ]
      : [
          { label: 'Add agent block', action: () => {
            this.addBlock(row, col)
            this.menu = null
            this.onUpdate()
          }},
        ]

    this.menu = new ContextMenu(r.row + row, r.col + col, items)
    this.onUpdate()
  }

  private addBlock(row: number, col: number): void {
    const id = `agent-${Date.now()}`
    const newBlock: Block = {
      id,
      row: Math.max(0, Math.round(row / GRID_ROWS) * GRID_ROWS),
      col: Math.max(0, Math.round(col / GRID_COLS) * GRID_COLS),
      height: 5,
      width: 18,
      title: id,
      status: 'idle',
      outputs: ['out'],
      inputs: ['in'],
    }
    this.state = { ...this.state, blocks: [...this.state.blocks, newBlock] }
  }

  private hitTestBlock(row: number, col: number): Block | undefined {
    return this.state.blocks.find(b =>
      row >= b.row && row < b.row + b.height &&
      col >= b.col && col < b.col + b.width
    )
  }

  private hitTestHeader(row: number, col: number): Block | undefined {
    return this.state.blocks.find(b =>
      row === b.row &&
      col >= b.col && col < b.col + b.width
    )
  }

  private focusedBlockId(): string | undefined {
    if (this.state.drag.kind === 'dragging') return this.state.drag.blockId
    return undefined
  }

  private portPosition(
    blockId: string,
    portName: string,
    side: 'output' | 'input'
  ): { row: number; col: number } | undefined {
    const block = this.state.blocks.find(b => b.id === blockId)
    if (!block) return undefined

    const ports = side === 'output' ? block.outputs : block.inputs
    const portIdx = ports.indexOf(portName)
    if (portIdx < 0) return undefined

    const portRow = block.row + 1 + portIdx
    const portCol = side === 'output'
      ? block.col + block.width - 1
      : block.col

    return { row: portRow, col: portCol }
  }
}
