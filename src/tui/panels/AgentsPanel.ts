import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import type { MouseEvent } from '../input/mouse.js'
import { Colors } from '../renderer/theme.js'
import { findLaureate } from '../../core/nobel.js'
import { logger } from '../../core/logger.js'

export interface AgentEntry {
  name:         string
  status:       'idle' | 'running' | 'done' | 'error'
  active?:      boolean   // the currently-focused session
  model?:       string
  inputTokens?: number
  outputTokens?: number
  toolCalls?:   number
  turns?:       number
  startTime?:   number
  endTime?:     number
}

const LIST_ROWS = 6  // max rows for the session list at the top

export class AgentsPanel extends Panel {
  private agents: AgentEntry[] = []
  private selectedIdx = 0
  private hoveredIdx = -1
  private showStats = false  // toggle stats on click
  private onUpdate: () => void
  private onSelect?: (idx: number) => void
  private log = logger('Agents')

  constructor(rect: Rect, onUpdate: () => void, onSelect?: (idx: number) => void) {
    super(rect)
    this.onUpdate = onUpdate
    if (onSelect) this.onSelect = onSelect
  }

  /** Replace the full session list (preserves selection by name when possible). */
  setAgents(agents: AgentEntry[]): void {
    const prevName = this.agents[this.selectedIdx]?.name
    this.agents = agents
    // Keep selection on the active session, else by previous name, else 0
    const activeIdx = agents.findIndex(a => a.active)
    const nameIdx = prevName ? agents.findIndex(a => a.name === prevName) : -1
    this.selectedIdx = activeIdx >= 0 ? activeIdx : nameIdx >= 0 ? nameIdx : 0
  }

  updateAgent(name: string, updates: Partial<AgentEntry>): void {
    const idx = this.agents.findIndex(a => a.name === name)
    if (idx >= 0) this.agents[idx] = { ...this.agents[idx]!, ...updates }
    else this.agents.push({ name, status: 'idle', ...updates })
    this.onUpdate()
  }

  render(buf: CellBuffer): void {
    const r = this.inner
    buf.fill(r.row, r.col, r.height, r.width, ' ', { bg: Colors.surfacePanel })

    if (this.agents.length === 0) {
      const msg = 'No sessions — F1 to create'
      buf.write(r.row + Math.floor(r.height / 2), r.col + Math.max(0, Math.floor((r.width - msg.length) / 2)),
        msg, { fg: Colors.textDim, bg: Colors.surfacePanel })
      return
    }

    // ── Session list ──────────────────────────────────────────────────────
    const listH = Math.min(this.agents.length, LIST_ROWS, Math.max(1, r.height - 8))
    for (let i = 0; i < listH; i++) {
      const a = this.agents[i]!
      const selected = i === this.selectedIdx
      const star = a.active ? '★ ' : '  '
      const badge = statusBadge(a.status)
      const line = `${star}${badge} ${a.name}`.padEnd(r.width).substring(0, r.width)
      const bg = selected ? Colors.surfaceActive : Colors.surfacePanel
      const fg = selected ? Colors.textBright : a.active ? Colors.primary : statusColor(a.status)
      buf.write(r.row + i, r.col, line, { fg, bg, bold: selected || !!a.active })
    }

    const detail = this.agents[this.selectedIdx]
    if (!detail || r.height <= listH + 1 || !this.showStats) return

    const dividerRow = r.row + listH
    buf.write(dividerRow, r.col, '─'.repeat(r.width), { fg: Colors.border, bg: Colors.surfacePanel })

    const rows: { label: string; value: string; fg?: number }[] = []
    if (detail.model) rows.push({ label: 'Model', value: detail.model, fg: Colors.info })
    const statusLabel = detail.status === 'running' ? '● Running' : detail.status === 'done' ? '✓ Done'
                      : detail.status === 'error' ? '✗ Error' : '○ Idle'
    rows.push({ label: 'Status', value: statusLabel, fg: statusColor(detail.status) })
    if (detail.startTime) {
      const endMs = detail.endTime ?? Date.now()
      rows.push({ label: 'Elapsed', value: `${((endMs - detail.startTime) / 1000).toFixed(1)}s` })
    }
    const inp = detail.inputTokens, out = detail.outputTokens
    if (inp !== undefined) {
      rows.push({ label: 'Input',  value: inp.toLocaleString() + ' tok', fg: Colors.textDim })
      rows.push({ label: 'Output', value: (out ?? 0).toLocaleString() + ' tok', fg: Colors.textDim })
      rows.push({ label: 'Total',  value: (inp + (out ?? 0)).toLocaleString() + ' tok', fg: Colors.primary })
    }
    if (detail.toolCalls !== undefined) {
      const tc = detail.toolCalls, t = detail.turns ?? 1
      rows.push({ label: 'Tools', value: `${tc} call${tc !== 1 ? 's' : ''} / ${t} turn${t !== 1 ? 's' : ''}`, fg: Colors.textDim })
    }

    const labelW = 8
    const maxRows = r.height - listH - 1
    for (let i = 0; i < Math.min(rows.length, maxRows); i++) {
      const sr = rows[i]!, y = dividerRow + 1 + i
      buf.write(y, r.col, sr.label.padEnd(labelW).substring(0, labelW), { fg: Colors.textDim, bg: Colors.surfacePanel })
      buf.write(y, r.col + labelW, sr.value.substring(0, r.width - labelW - 2), { fg: sr.fg ?? Colors.text, bg: Colors.surfacePanel })
    }

    // ── Hover tooltip — laureate quote + contribution ─────────────────────
    const hov = this.agents[this.hoveredIdx]
    if (hov) this.renderTooltip(buf, r, hov.name)
  }

  private renderTooltip(buf: CellBuffer, r: Rect, name: string): void {
    const l = findLaureate(name)
    if (!l) return
    const lines = [
      `${l.name} · ${l.field} · ${l.year}`,
      `"${l.quote}"`,
      l.contribution,
    ]
    const boxW = Math.min(r.width, Math.max(...lines.map(s => s.length)) + 2)
    const boxH = lines.length + 2
    const boxRow = r.row + r.height - boxH    // anchored to bottom of the panel
    const boxCol = r.col
    buf.fill(boxRow, boxCol, boxH, boxW, ' ', { bg: Colors.surfaceActive })
    const hLine = '─'.repeat(boxW - 2)
    buf.write(boxRow, boxCol, '┌' + hLine + '┐', { fg: Colors.warning, bg: Colors.surfaceActive })
    buf.write(boxRow + boxH - 1, boxCol, '└' + hLine + '┘', { fg: Colors.warning, bg: Colors.surfaceActive })
    for (let i = 0; i < lines.length; i++) {
      const fg = i === 0 ? Colors.warning : i === 1 ? Colors.textBright : Colors.textDim
      buf.write(boxRow + 1 + i, boxCol, '│', { fg: Colors.warning, bg: Colors.surfaceActive })
      buf.write(boxRow + 1 + i, boxCol + 1, lines[i]!.substring(0, boxW - 2).padEnd(boxW - 2), { fg, bg: Colors.surfaceActive })
      buf.write(boxRow + 1 + i, boxCol + boxW - 1, '│', { fg: Colors.warning, bg: Colors.surfaceActive })
    }
  }

  override onMouse(e: MouseEvent): boolean {
    const r = this.inner
    const listH = Math.min(this.agents.length, LIST_ROWS, Math.max(1, r.height - 8))
    const row = e.row - r.row

    // Hover (passive motion) → tooltip; only consume when it changes
    if (e.action === 'move') {
      const newHover = (row >= 0 && row < listH) ? row : -1
      if (newHover !== this.hoveredIdx) { this.hoveredIdx = newHover; this.onUpdate(); return true }
      return false
    }
    if (e.button === 'scroll_up')   { this.selectedIdx = Math.max(0, this.selectedIdx - 1); this.onUpdate(); return true }
    if (e.button === 'scroll_down') { this.selectedIdx = Math.min(this.agents.length - 1, this.selectedIdx + 1); this.onUpdate(); return true }
    if (e.button !== 'left' || e.action !== 'press') return false
    if (row >= 0 && row < listH) {
      // Same session: toggle stats; different session: switch and show stats
      if (this.selectedIdx === row) {
        this.showStats = !this.showStats
      } else {
        this.selectedIdx = row
        this.showStats = true
      }
      this.log.debug('session selected', { name: this.agents[row]?.name })
      this.onSelect?.(row)   // switch the active session
      this.onUpdate()
      return true
    }
    return false
  }
}

function statusBadge(status: AgentEntry['status']): string {
  switch (status) {
    case 'idle':    return '○'
    case 'running': return '●'
    case 'done':    return '✓'
    case 'error':   return '✗'
  }
}

function statusColor(status: AgentEntry['status']): number {
  switch (status) {
    case 'idle':    return Colors.textDim
    case 'running': return Colors.primary
    case 'done':    return Colors.success
    case 'error':   return Colors.danger
  }
}
