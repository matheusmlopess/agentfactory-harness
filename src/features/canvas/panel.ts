import { Panel } from '../../shared/panel.js'
import type { CellBuffer } from '../../shared/renderer/cell-buffer.js'
import type { KeyEvent } from '../../shared/input/keyboard.js'
import type { MouseEvent } from '../../shared/input/mouse.js'
import type { Rect } from '../../shared/renderer/layout.js'
import { Colors, Wire as WireChars } from '../../shared/renderer/theme.js'
import { type Block, renderBlock } from './Block.js'
import { routeWire } from './Wire.js'
import { ContextMenu } from '../../shared/widgets/ContextMenu.js'
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
  | { kind: 'wiring';   fromBlockId: string; fromPort: string; cursorRow: number; cursorCol: number }

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
    buf.fill(r.row, r.col, r.height, r.width, ' ', { bg: Colors.surfacePanel })

    // Draw grid dots
    for (let row = 0; row < r.height; row += GRID_ROWS) {
      for (let col = 0; col < r.width; col += GRID_COLS) {
        buf.write(r.row + row, r.col + col, '·', { fg: Colors.surfaceActive })
      }
    }

    // Draw wires
    for (const wire of this.state.wires) {
      const from = this.portPosition(wire.fromBlockId, wire.fromPort, 'output')
      const to   = this.portPosition(wire.toBlockId,   wire.toPort,   'input')
      if (!from || !to) continue
      for (const pt of routeWire(from, to)) {
        if (pt.row >= 0 && pt.row < r.height && pt.col >= 0 && pt.col < r.width) {
          buf.write(r.row + pt.row, r.col + pt.col, pt.char, { fg: Colors.primary })
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

    // Wiring preview — drawn after blocks so it floats on top
    if (drag.kind === 'wiring') {
      const from = this.portPosition(drag.fromBlockId, drag.fromPort, 'output')
      if (from) {
        const preview = routeWire(from, { row: drag.cursorRow, col: drag.cursorCol })
        for (const pt of preview) {
          if (pt.row >= 0 && pt.row < r.height && pt.col >= 0 && pt.col < r.width) {
            buf.write(r.row + pt.row, r.col + pt.col, pt.char, { fg: Colors.warning })
          }
        }
        if (drag.cursorRow >= 0 && drag.cursorRow < r.height &&
            drag.cursorCol >= 0 && drag.cursorCol < r.width) {
          buf.write(r.row + drag.cursorRow, r.col + drag.cursorCol, '◎', { fg: Colors.warning })
        }
      }
    }

    // Draw context menu on top — pass absolute bottom-right boundary
    if (this.menu) {
      this.menu.render(buf, r.row + r.height, r.col + r.width)
    }
  }

  onKey(e: KeyEvent): boolean {
    // Esc cancels wiring mode (checked before menu so a single Esc is enough)
    if (e.key === 'escape' && this.state.drag.kind === 'wiring') {
      this.state = { ...this.state, drag: { kind: 'idle' } }
      this.onUpdate()
      return true
    }
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

    // Menu owns clicks while open — items are clickable, elsewhere dismisses.
    // Consume so the event doesn't also start a drag.
    if (this.menu && e.action === 'press') {
      this.menu.onMouse(e)
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
    const drag = this.state.drag

    // ── Complete or cancel a wire in progress ──────────────────────────────
    if (drag.kind === 'wiring') {
      const target = this.hitTestInputPort(row, col)
      if (target && target.block.id !== drag.fromBlockId) {
        const wireId = `${drag.fromBlockId}:${drag.fromPort}→${target.block.id}:${target.portName}`
        const isDuplicate = this.state.wires.some(
          w => w.fromBlockId === drag.fromBlockId && w.fromPort === drag.fromPort &&
               w.toBlockId === target.block.id   && w.toPort   === target.portName
        )
        if (!isDuplicate) {
          this.state = {
            ...this.state,
            wires: [...this.state.wires, {
              id: wireId,
              fromBlockId: drag.fromBlockId,
              fromPort:    drag.fromPort,
              toBlockId:   target.block.id,
              toPort:      target.portName,
            }],
          }
        }
      }
      this.state = { ...this.state, drag: { kind: 'idle' } }
      this.onUpdate()
      return true
    }

    // ── Click on output port → start wiring mode ───────────────────────────
    const outPort = this.hitTestOutputPort(row, col)
    if (outPort) {
      this.state = {
        ...this.state,
        drag: {
          kind: 'wiring',
          fromBlockId: outPort.block.id,
          fromPort:    outPort.portName,
          cursorRow:   row,
          cursorCol:   col,
        },
      }
      this.onUpdate()
      return true
    }

    // ── Block header drag ──────────────────────────────────────────────────
    const block = this.hitTestHeader(row, col)
    if (!block) return false
    this.state = {
      ...this.state,
      drag: {
        kind: 'dragging',
        blockId:   block.id,
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
    const drag = this.state.drag
    if (drag.kind === 'dragging') {
      this.ghostRow = row - drag.offsetRow
      this.ghostCol = col - drag.offsetCol
      this.onUpdate()
      return true
    }
    if (drag.kind === 'wiring') {
      this.state = { ...this.state, drag: { ...drag, cursorRow: row, cursorCol: col } }
      this.onUpdate()
      return true
    }
    return false
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
    // Cancel any active wiring on right-click
    if (this.state.drag.kind === 'wiring') {
      this.state = { ...this.state, drag: { kind: 'idle' } }
    }

    const wire  = this.hitTestWire(row, col)
    const block = wire ? undefined : this.hitTestBlock(row, col)
    const r = this.inner

    const items = wire
      ? [
          { label: 'Delete wire', danger: true, action: () => {
            this.state = { ...this.state, wires: this.state.wires.filter(w => w.id !== wire.id) }
            this.menu = null
            this.onUpdate()
          }},
        ]
      : block
      ? [
          { label: 'Open session', action: () => { this.menu = null; this.onUpdate() } },
          { label: 'Delete block', danger: true, action: () => {
            this.state = {
              ...this.state,
              blocks: this.state.blocks.filter(b => b.id !== block.id),
              // Cascade-remove wires that referenced the deleted block
              wires: this.state.wires.filter(
                w => w.fromBlockId !== block.id && w.toBlockId !== block.id
              ),
            }
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

    this.menu = new ContextMenu(r.row + row, r.col + col, items,
      () => { this.menu = null; this.onUpdate() })
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
    if (this.state.drag.kind === 'wiring')   return this.state.drag.fromBlockId
    return undefined
  }

  private hitTestOutputPort(row: number, col: number): { block: Block; portName: string } | undefined {
    for (const block of this.state.blocks) {
      for (let i = 0; i < block.outputs.length; i++) {
        if (row === block.row + 1 + i && col === block.col + block.width - 1) {
          return { block, portName: block.outputs[i]! }
        }
      }
    }
    return undefined
  }

  private hitTestInputPort(row: number, col: number): { block: Block; portName: string } | undefined {
    for (const block of this.state.blocks) {
      for (let i = 0; i < block.inputs.length; i++) {
        if (row === block.row + 1 + i && col === block.col) {
          return { block, portName: block.inputs[i]! }
        }
      }
    }
    return undefined
  }

  private hitTestWire(row: number, col: number): CanvasWire | undefined {
    for (const wire of this.state.wires) {
      const from = this.portPosition(wire.fromBlockId, wire.fromPort, 'output')
      const to   = this.portPosition(wire.toBlockId,   wire.toPort,   'input')
      if (!from || !to) continue
      if (routeWire(from, to).some(pt => pt.row === row && pt.col === col)) return wire
    }
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
