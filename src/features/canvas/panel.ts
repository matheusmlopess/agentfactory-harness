import { Panel } from '../../shared/panel.js'
import type { CellBuffer } from '../../shared/renderer/cell-buffer.js'
import type { KeyEvent } from '../../shared/input/keyboard.js'
import type { MouseEvent } from '../../shared/input/mouse.js'
import type { Rect } from '../../shared/renderer/layout.js'
import { Colors } from '../../shared/renderer/theme.js'
import { type Block, renderBlock } from './Block.js'
import { routeWire } from './Wire.js'
import { ContextMenu } from '../../shared/widgets/ContextMenu.js'
import { NodeInspector } from './NodeInspector.js'
import type { Plan } from '../../orchestration/schema.js'
import type { StepEvent } from '../../orchestration/executor.js'
import {
  emptyModel, deriveView, planToStudio,
  type StudioModel, type StudioNode,
} from '../../orchestration/studio-model.js'

export interface CanvasWire {
  id: string
  fromBlockId: string
  fromPort: string
  toBlockId: string
  toPort: string
  /** Typed connector (PLAN-13 §7); absent = legacy dependency. */
  kind?: 'dependency' | 'handoff'
  payload?: string
}

interface ToolboxItem {
  agent: string
  label: string
  promptStub: string
}

const TOOLBOX: readonly ToolboxItem[] = [
  { agent: 'generic',  label: 'generic',  promptStub: '' },
  { agent: 'planner',  label: 'planner',  promptStub: 'Plan the work for: ' },
  { agent: 'worker',   label: 'worker',   promptStub: 'Implement: ' },
  { agent: 'reviewer', label: 'reviewer', promptStub: 'Review the following work: ' },
  { agent: 'critic',   label: 'critic',   promptStub: 'Critique and find flaws in: ' },
]
const TOOLBOX_W = 14

type DragState =
  | { kind: 'idle' }
  | { kind: 'dragging'; blockId: string; offsetRow: number; offsetCol: number }
  | { kind: 'wiring';   fromBlockId: string; fromPort: string; cursorRow: number; cursorCol: number }
  | { kind: 'placing';  template: ToolboxItem }

export interface CanvasState {
  blocks: Block[]
  wires: CanvasWire[]
  drag: DragState
}

const GRID_ROWS = 2
const GRID_COLS = 4

/**
 * ITUI canvas — Build mode (PLAN-13, standalone). Ownership inverted: the
 * pure StudioModel is the source of truth; blocks/wires are a render cache
 * rebuilt by deriveView() after every mutation. Blocks carry real agent
 * data, wires are typed, and the graph serializes to af-plan.json.
 */
export class OrchestrationCanvas extends Panel {
  private model: StudioModel = emptyModel()
  /** Run-status overlay keyed by node id (fed by applyStepEvent). */
  private statuses: Record<string, Block['status']> = {}
  private state: CanvasState = { blocks: [], wires: [], drag: { kind: 'idle' } }
  private selectedNodeId: string | null = null
  private inspector: NodeInspector | null = null
  private toolboxOpen = false
  private menu: ContextMenu | null = null
  private onUpdate: () => void
  private nextNodeSeq = 1

  constructor(rect: Rect, onUpdate: () => void) {
    super(rect)
    this.onUpdate = onUpdate
  }

  // ── Model access ────────────────────────────────────────────────────────

  getModel(): StudioModel {
    return this.model
  }

  get selectedId(): string | null {
    return this.selectedNodeId
  }

  /** Rebuild the derived render view from the model (PLAN-13 §4.5). */
  private rebuild(): void {
    const v = deriveView(this.model, this.statuses)
    this.state = { ...this.state, blocks: v.blocks, wires: v.wires }
  }

  /**
   * Legacy entry point (kept for compatibility): hydrates the model FROM a
   * block/wire view. Titles become agent names; prompts start empty.
   */
  loadState(state: CanvasState): void {
    this.model = {
      name: this.model.name,
      nodes: state.blocks.map(b => ({
        id: b.id, kind: 'agent' as const, row: b.row, col: b.col,
        agent: b.title, prompt: '', w: b.width, h: b.height,
      })),
      edges: state.wires.map(w => ({
        id: w.id, from: w.fromBlockId, to: w.toBlockId,
        kind: w.kind ?? 'dependency',
        ...(w.payload !== undefined ? { payload: w.payload } : {}),
      })),
    }
    this.statuses = Object.fromEntries(state.blocks.map(b => [b.id, b.status]))
    this.rebuild()
    this.state = { ...this.state, drag: state.drag }
  }

  getState(): CanvasState {
    return this.state
  }

  /** Populate the model from an af-plan.json Plan (x-studio-aware). */
  syncFromPlan(plan: Plan): void {
    this.model = planToStudio(plan)
    this.statuses = {}
    this.selectedNodeId = null
    this.rebuild()
    this.onUpdate()
  }

  /** Update a node's run status from an executor StepEvent — keeps
   *  pending/skipped distinct (no more skipped→idle collapse). */
  applyStepEvent(event: StepEvent): void {
    if (event.type === 'plan:done') return
    this.statuses[event.stepId] = event.status
    this.rebuild()
    this.onUpdate()
  }

  // ── Rendering ───────────────────────────────────────────────────────────

  render(buf: CellBuffer): void {
    const r = this.inner
    buf.fill(r.row, r.col, r.height, r.width, ' ', { bg: Colors.surfacePanel })

    // Draw grid dots
    for (let row = 0; row < r.height; row += GRID_ROWS) {
      for (let col = 0; col < r.width; col += GRID_COLS) {
        buf.write(r.row + row, r.col + col, '·', { fg: Colors.surfaceActive })
      }
    }

    // Draw wires — handoff edges get the ═ glyph + [H] midpoint label so the
    // type is legible without color (a11y)
    for (const wire of this.state.wires) {
      const from = this.portPosition(wire.fromBlockId, wire.fromPort, 'output')
      const to   = this.portPosition(wire.toBlockId,   wire.toPort,   'input')
      if (!from || !to) continue
      const isHandoff = wire.kind === 'handoff'
      const pts = routeWire(from, to)
      for (const pt of pts) {
        if (pt.row >= 0 && pt.row < r.height && pt.col >= 0 && pt.col < r.width) {
          const char = isHandoff && pt.char === '─' ? '═' : pt.char
          buf.write(r.row + pt.row, r.col + pt.col, char, { fg: Colors.primary })
        }
      }
      if (isHandoff && pts.length > 2) {
        const mid = pts[Math.floor(pts.length / 2)]!
        if (mid.row >= 0 && mid.row < r.height && mid.col >= 0 && mid.col + 2 < r.width) {
          buf.write(r.row + mid.row, r.col + mid.col, '[H]', { fg: Colors.warning, bold: true })
        }
      }
    }

    // Draw blocks — selection shows as the focused border (click-to-select)
    const drag = this.state.drag
    for (const block of this.state.blocks) {
      const isDragged = drag.kind === 'dragging' && drag.blockId === block.id
      const focused = block.id === this.focusedBlockId() || block.id === this.selectedNodeId
      renderBlock(buf, block, focused, r.row, r.col, isDragged)

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

    if (this.toolboxOpen) this.renderToolbox(buf, r)

    // Placement-mode hint
    if (drag.kind === 'placing') {
      buf.write(r.row + r.height - 1, r.col + 1,
        ` placing "${drag.template.label}" — click a cell to drop, Esc cancels `.substring(0, r.width - 2),
        { fg: Colors.warning, bg: Colors.surfacePanel, bold: true })
    }

    // Overlays on top
    if (this.menu) this.menu.render(buf, r.row + r.height, r.col + r.width)
    if (this.inspector) this.inspector.render(buf, r)
  }

  private renderToolbox(buf: CellBuffer, r: Rect): void {
    buf.fill(r.row, r.col, r.height, TOOLBOX_W, ' ', { bg: Colors.surfaceActive })
    buf.write(r.row, r.col + 1, 'TOOLBOX [t]', { fg: Colors.textBright, bg: Colors.surfaceActive, bold: true })
    for (let i = 0; i < TOOLBOX.length; i++) {
      const item = TOOLBOX[i]!
      const placing = this.state.drag.kind === 'placing' && this.state.drag.template === item
      buf.write(r.row + 1 + i, r.col + 1, `${placing ? '►' : '▸'} ${item.label}`.padEnd(TOOLBOX_W - 1), {
        fg: placing ? Colors.surface : Colors.text,
        bg: placing ? Colors.primary : Colors.surfaceActive,
        bold: placing,
      })
    }
  }

  // ── Keys ────────────────────────────────────────────────────────────────

  onKey(e: KeyEvent): boolean {
    // Inspector is modal — it consumes everything while open
    if (this.inspector) {
      const consumed = this.inspector.onKey(e)
      this.onUpdate()
      return consumed
    }

    // Esc cancels transient modes in priority order (input convention)
    if (e.key === 'escape' && this.state.drag.kind === 'wiring') {
      this.state = { ...this.state, drag: { kind: 'idle' } }
      this.onUpdate()
      return true
    }
    if (e.key === 'escape' && this.state.drag.kind === 'placing') {
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
    if (e.key === 'escape' && this.selectedNodeId !== null) {
      this.selectedNodeId = null
      this.onUpdate()
      return true
    }

    if (e.key === 't') {
      this.toolboxOpen = !this.toolboxOpen
      if (!this.toolboxOpen && this.state.drag.kind === 'placing') {
        this.state = { ...this.state, drag: { kind: 'idle' } }
      }
      this.onUpdate()
      return true
    }
    if ((e.key === 'enter' || e.key === 'e') && this.selectedNodeId !== null) {
      this.openInspector(this.selectedNodeId)
      return true
    }
    return false
  }

  // ── Mouse ───────────────────────────────────────────────────────────────

  onMouse(e: MouseEvent): boolean {
    const r = this.inner
    const canvasRow = e.row - r.row
    const canvasCol = e.col - r.col

    if (canvasRow < 0 || canvasRow >= r.height || canvasCol < 0 || canvasCol >= r.width) {
      return false
    }

    // Inspector is modal
    if (this.inspector) {
      if (e.action === 'press' || e.button === 'scroll_up' || e.button === 'scroll_down') {
        this.inspector.onMouse(e, r)
        this.onUpdate()
      }
      return true
    }

    // Menu owns clicks while open — items are clickable, elsewhere dismisses.
    if (this.menu && e.action === 'press') {
      this.menu.onMouse(e)
      this.onUpdate()
      return true
    }

    // Toolbox rail clicks
    if (this.toolboxOpen && canvasCol < TOOLBOX_W && e.button === 'left' && e.action === 'press') {
      const idx = canvasRow - 1
      const item = idx >= 0 ? TOOLBOX[idx] : undefined
      if (item) {
        this.state = { ...this.state, drag: { kind: 'placing', template: item } }
        this.onUpdate()
      }
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

    // ── Drop a toolbox template ─────────────────────────────────────────────
    if (drag.kind === 'placing') {
      const id = this.addNode(row, col, drag.template)
      this.state = { ...this.state, drag: { kind: 'idle' } }
      this.openInspector(id)
      this.onUpdate()
      return true
    }

    // ── Complete or cancel a wire in progress ──────────────────────────────
    if (drag.kind === 'wiring') {
      const target = this.hitTestInputPort(row, col)
      if (target && target.block.id !== drag.fromBlockId) {
        const from = drag.fromBlockId
        const to = target.block.id
        const isDuplicate = this.model.edges.some(e => e.from === from && e.to === to)
        if (!isDuplicate) this.openConnectorMenu(row, col, from, to)
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
    if (block) {
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

    // ── Body click → select (distinct from drag); empty click → deselect ───
    const bodyBlock = this.hitTestBlock(row, col)
    if (bodyBlock) {
      this.selectedNodeId = bodyBlock.id
      this.onUpdate()
      return true
    }
    if (this.selectedNodeId !== null) {
      this.selectedNodeId = null
      this.onUpdate()
      return true
    }
    return false
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

    // Drag writes the position back into the model — the view is derived
    this.mutateNode(drag.blockId, n => { n.row = snappedRow; n.col = snappedCol })
    this.state = { ...this.state, drag: { kind: 'idle' } }
    this.ghostRow = null
    this.ghostCol = null
    this.onUpdate()
    return true
  }

  // ── Model mutations ─────────────────────────────────────────────────────

  private mutateNode(id: string, fn: (n: StudioNode) => void): void {
    const node = this.model.nodes.find(n => n.id === id)
    if (!node) return
    fn(node)
    this.rebuild()
  }

  private addNode(row: number, col: number, template?: ToolboxItem): string {
    let id = `agent-${this.nextNodeSeq++}`
    while (this.model.nodes.some(n => n.id === id)) id = `agent-${this.nextNodeSeq++}`
    this.model.nodes.push({
      id,
      kind: 'agent',
      row: Math.max(0, Math.round(row / GRID_ROWS) * GRID_ROWS),
      col: Math.max(0, Math.round(col / GRID_COLS) * GRID_COLS),
      agent: template?.agent ?? 'generic',
      prompt: template?.promptStub ?? '',
      w: 18,
      h: 5,
    })
    this.rebuild()
    return id
  }

  private addEdge(from: string, to: string, kind: 'dependency' | 'handoff', payload?: string): void {
    this.model.edges.push({
      id: `${from}→${to}`,
      from, to, kind,
      ...(payload !== undefined ? { payload } : {}),
    })
    this.rebuild()
  }

  private deleteNode(id: string): void {
    this.model.nodes = this.model.nodes.filter(n => n.id !== id)
    this.model.edges = this.model.edges.filter(e => e.from !== id && e.to !== id)
    if (this.selectedNodeId === id) this.selectedNodeId = null
    this.rebuild()
  }

  private openInspector(nodeId: string): void {
    const node = this.model.nodes.find(n => n.id === nodeId)
    if (!node) return
    this.inspector = new NodeInspector(node, {
      takenIds: this.model.nodes.filter(n => n.id !== nodeId).map(n => n.id),
      onSave: (updated) => {
        const oldId = nodeId
        Object.assign(node, updated)
        if (updated.id !== oldId) {
          // Remap edges + status + selection to the renamed node
          for (const edge of this.model.edges) {
            if (edge.from === oldId) edge.from = updated.id
            if (edge.to === oldId) edge.to = updated.id
            edge.id = `${edge.from}→${edge.to}`
          }
          if (this.statuses[oldId] !== undefined) {
            this.statuses[updated.id] = this.statuses[oldId]!
            delete this.statuses[oldId]
          }
          if (this.selectedNodeId === oldId) this.selectedNodeId = updated.id
        }
        this.inspector = null
        this.rebuild()
        this.onUpdate()
      },
      onCancel: () => {
        this.inspector = null
        this.onUpdate()
      },
    })
    this.onUpdate()
  }

  /** Typed-connector menu on wire completion (PLAN-13 §7). */
  private openConnectorMenu(row: number, col: number, from: string, to: string): void {
    const r = this.inner
    this.menu = new ContextMenu(r.row + row, r.col + col, [
      { label: 'dependency (ordering)', action: () => { this.addEdge(from, to, 'dependency'); this.menu = null; this.onUpdate() } },
      { label: 'handoff: summary',      action: () => { this.addEdge(from, to, 'handoff', 'summary'); this.menu = null; this.onUpdate() } },
      { label: 'handoff: full',         action: () => { this.addEdge(from, to, 'handoff', 'full'); this.menu = null; this.onUpdate() } },
    ], () => { this.menu = null; this.onUpdate() })
    this.onUpdate()
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
            this.model.edges = this.model.edges.filter(e => e.id !== wire.id)
            this.rebuild()
            this.menu = null
            this.onUpdate()
          }},
        ]
      : block
      ? [
          { label: 'Configure…', action: () => { this.menu = null; this.openInspector(block.id) } },
          { label: 'Delete block', danger: true, action: () => {
            this.deleteNode(block.id)
            this.menu = null
            this.onUpdate()
          }},
        ]
      : [
          { label: 'Add agent block', action: () => {
            const id = this.addNode(row, col)
            this.menu = null
            this.openInspector(id)
            this.onUpdate()
          }},
          { label: 'Toggle toolbox', action: () => {
            this.toolboxOpen = !this.toolboxOpen
            this.menu = null
            this.onUpdate()
          }},
        ]

    this.menu = new ContextMenu(r.row + row, r.col + col, items,
      () => { this.menu = null; this.onUpdate() })
    this.onUpdate()
  }

  // ── Hit tests (over the derived view) ───────────────────────────────────

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
