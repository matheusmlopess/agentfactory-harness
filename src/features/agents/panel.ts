import { Panel } from '../../shared/panel.js'
import type { CellBuffer } from '../../shared/renderer/cell-buffer.js'
import type { Rect } from '../../shared/renderer/layout.js'
import type { KeyEvent } from '../../shared/input/keyboard.js'
import type { MouseEvent } from '../../shared/input/mouse.js'
import { Colors } from '../../shared/renderer/theme.js'
import { findLaureate } from '../../core/nobel.js'
import { logger } from '../../core/logger.js'
import type { Plan } from '../../orchestration/schema.js'
import type { StepEvent, StepStatus } from '../../orchestration/executor.js'

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

/** One plan step in team mode (PLAN-10 standalone: fed by StepEvents). */
interface TeamRow {
  id: string
  agent: string
  status: StepStatus
  durationMs?: number
  output?: string
  error?: string
}

const LIST_ROWS = 6  // max rows for the session list at the top
const TEAM_LOG_MAX = 100

export class AgentsPanel extends Panel {
  private agents: AgentEntry[] = []
  private selectedIdx = 0
  private hoveredIdx = -1
  private showStats = false  // toggle stats on click
  private onUpdate: () => void
  private onSelect?: (idx: number) => void
  private log = logger('Agents')

  // Team mode (PLAN-10 standalone) — sessions mode stays byte-identical
  private panelMode: 'sessions' | 'team' = 'sessions'
  private teamName = ''
  private teamRows: TeamRow[] = []
  private teamLog: string[] = []
  private teamSelected = 0

  constructor(rect: Rect, onUpdate: () => void, onSelect?: (idx: number) => void) {
    super(rect)
    this.onUpdate = onUpdate
    if (onSelect) this.onSelect = onSelect
  }

  get mode(): 'sessions' | 'team' {
    return this.panelMode
  }

  /** Enter team mode for a plan run — rows start pending. */
  setPlan(plan: Plan): void {
    this.panelMode = 'team'
    this.teamName = plan.name
    this.teamRows = plan.steps.map(s => ({ id: s.id, agent: s.agent, status: 'pending' as StepStatus }))
    this.teamLog = []
    this.teamSelected = 0
    this.onUpdate()
  }

  /** Mutate rows + rolling event log from an executor StepEvent. */
  onPlanEvent(ev: StepEvent): void {
    const ts = new Date().toTimeString().slice(0, 8)
    if (ev.type === 'plan:done') {
      this.teamLog.push(`${ts} plan:done`)
    } else {
      const row = this.teamRows.find(r => r.id === ev.stepId)
      if (row) {
        row.status = ev.status
        if (ev.durationMs !== undefined) row.durationMs = ev.durationMs
        if (ev.output !== undefined) row.output = ev.output
        if (ev.error !== undefined) row.error = ev.error
      }
      const dur = ev.durationMs !== undefined ? ` (${(ev.durationMs / 1000).toFixed(1)}s)` : ''
      const err = ev.error !== undefined ? ` — ${ev.error}` : ''
      this.teamLog.push(`${ts} ${ev.type} ${ev.stepId}${dur}${err}`)
    }
    if (this.teamLog.length > TEAM_LOG_MAX) this.teamLog.splice(0, this.teamLog.length - TEAM_LOG_MAX)
    this.onUpdate()
  }

  /** Back to the session list (Esc in team mode). */
  exitTeamMode(): void {
    this.panelMode = 'sessions'
    this.onUpdate()
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

    // Team mode replaces the session list entirely (tooltip suppressed)
    if (this.panelMode === 'team') {
      this.renderTeam(buf, r)
      return
    }

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

  /**
   * Team dashboard (PLAN-10 standalone): step list with glyph+text status
   * (a11y — never color-only), selected-step detail, rolling event log.
   * Two columns at ≥70 cols, stacked below.
   */
  private renderTeam(buf: CellBuffer, r: Rect): void {
    const running = this.teamRows.filter(t => t.status === 'running').length
    const header = ` Team — ${this.teamName}  [${running} running / ${this.teamRows.length} total]  (Esc: sessions)`
    buf.write(r.row, r.col, header.substring(0, r.width), { fg: Colors.textBright, bg: Colors.surfacePanel, bold: true })

    const twoCol = r.width >= 70
    const listW = twoCol ? Math.floor(r.width * 0.45) : r.width
    const listTop = r.row + 1
    const listH = twoCol ? r.height - 1 : Math.max(1, Math.floor((r.height - 1) / 2))

    for (let i = 0; i < Math.min(this.teamRows.length, listH); i++) {
      const row = this.teamRows[i]!
      const selected = i === this.teamSelected
      const line = ` ${teamBadge(row.status)} ${row.id} [${row.status}]${row.durationMs !== undefined ? ` ${(row.durationMs / 1000).toFixed(1)}s` : ''}`
      buf.write(listTop + i, r.col, line.substring(0, listW).padEnd(listW), {
        fg: selected ? Colors.textBright : teamColor(row.status),
        bg: selected ? Colors.surfaceActive : Colors.surfacePanel,
        bold: selected,
      })
    }

    // Detail + event log column (or stacked lower half)
    const detailCol = twoCol ? r.col + listW + 1 : r.col
    const detailTop = twoCol ? listTop : listTop + listH
    const detailW = twoCol ? r.width - listW - 1 : r.width
    const detailH = twoCol ? r.height - 1 : r.height - 1 - listH
    if (detailH <= 0) return

    if (twoCol) {
      for (let i = 0; i < detailH; i++) {
        buf.write(detailTop + i, r.col + listW, '│', { fg: Colors.border, bg: Colors.surfacePanel })
      }
    }

    const sel = this.teamRows[this.teamSelected]
    let y = detailTop
    if (sel) {
      const excerpt = sel.error ?? sel.output ?? ''
      buf.write(y, detailCol, ` ${sel.id} · agent: ${sel.agent}`.substring(0, detailW), {
        fg: Colors.textBright, bg: Colors.surfacePanel, bold: true,
      })
      y++
      if (excerpt && y < detailTop + detailH) {
        const fg = sel.error !== undefined ? Colors.danger : Colors.textDim
        for (const line of excerpt.split('\n').slice(0, 3)) {
          if (y >= detailTop + detailH) break
          buf.write(y, detailCol, ` ${line}`.substring(0, detailW), { fg, bg: Colors.surfacePanel })
          y++
        }
      }
      y++
    }

    // Rolling event log fills the rest, newest last
    const logRows = detailTop + detailH - y
    if (logRows > 0) {
      const visible = this.teamLog.slice(-logRows)
      for (let i = 0; i < visible.length; i++) {
        buf.write(y + i, detailCol, ` ${visible[i]!}`.substring(0, detailW), {
          fg: Colors.textDim, bg: Colors.surfacePanel,
        })
      }
    }
  }

  override onKey(e: KeyEvent): boolean {
    if (this.panelMode !== 'team') return false
    if (e.key === 'escape') { this.exitTeamMode(); return true }
    if (e.key === 'arrow_up')   { this.teamSelected = Math.max(0, this.teamSelected - 1); this.onUpdate(); return true }
    if (e.key === 'arrow_down') { this.teamSelected = Math.min(this.teamRows.length - 1, this.teamSelected + 1); this.onUpdate(); return true }
    return false
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

    // Team mode: click selects a step row
    if (this.panelMode === 'team') {
      if (e.button === 'left' && e.action === 'press') {
        const idx = e.row - (r.row + 1)
        if (idx >= 0 && idx < this.teamRows.length) {
          this.teamSelected = idx
          this.onUpdate()
          return true
        }
      }
      return false
    }

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

function teamBadge(status: StepStatus): string {
  switch (status) {
    case 'pending': return '◎'
    case 'running': return '●'
    case 'done':    return '✓'
    case 'error':   return '✗'
    case 'skipped': return '⊘'
  }
}

function teamColor(status: StepStatus): number {
  switch (status) {
    case 'pending': return Colors.textDim
    case 'running': return Colors.primary
    case 'done':    return Colors.success
    case 'error':   return Colors.danger
    case 'skipped': return Colors.textDim
  }
}
