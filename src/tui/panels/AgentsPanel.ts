import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import type { MouseEvent } from '../input/mouse.js'
import { Colors } from '../renderer/theme.js'

export interface AgentEntry {
  name:         string
  status:       'idle' | 'running' | 'done' | 'error'
  model?:       string
  inputTokens?: number
  outputTokens?: number
  toolCalls?:   number
  turns?:       number
  startTime?:   number   // Date.now()
  endTime?:     number
}

const LIST_ROWS = 6  // rows devoted to the agent list at the top

export class AgentsPanel extends Panel {
  private agents: AgentEntry[] = []
  private selectedIdx = -1
  private onUpdate: () => void

  constructor(rect: Rect, onUpdate: () => void) {
    super(rect)
    this.onUpdate = onUpdate
  }

  setAgents(agents: AgentEntry[]): void {
    this.agents = agents
    this.selectedIdx = -1
  }

  /** Update a single agent's fields by name. Creates the entry if it doesn't exist. */
  updateAgent(name: string, updates: Partial<AgentEntry>): void {
    const idx = this.agents.findIndex(a => a.name === name)
    if (idx >= 0) {
      this.agents[idx] = { ...this.agents[idx]!, ...updates }
    } else {
      this.agents.push({ name, status: 'idle', ...updates })
    }
    this.onUpdate()
  }

  render(buf: CellBuffer): void {
    const r = this.inner
    buf.fill(r.row, r.col, r.height, r.width, ' ', { bg: Colors.bgPanel })

    if (this.agents.length === 0) {
      const msg = 'No active agents'
      buf.write(
        r.row + Math.floor(r.height / 2),
        r.col + Math.floor((r.width - msg.length) / 2),
        msg,
        { fg: Colors.textDim, bg: Colors.bgPanel }
      )
      return
    }

    // ── Agent list (compact — only as many rows as there are agents) ──────
    const listH = Math.min(this.agents.length, LIST_ROWS, Math.max(1, r.height - 6))
    for (let i = 0; i < listH; i++) {
      const agent    = this.agents[i]!
      const selected = i === this.selectedIdx
      const badge    = statusBadge(agent.status)
      const hint     = selected ? '' : '  (click for stats)'
      const line     = `${badge} ${agent.name}${hint}`.padEnd(r.width).substring(0, r.width)
      const bg       = selected ? Colors.bgActive : Colors.bgPanel
      const fg       = selected ? Colors.textBright : statusColor(agent.status)
      buf.write(r.row + i, r.col, line, { fg, bg, bold: selected })
    }

    // ── Stats detail (shown when an agent is selected) ────────────────────
    const detailAgent = this.agents[this.selectedIdx]
    if (!detailAgent || r.height <= listH + 1) return

    const dividerRow = r.row + listH
    buf.write(dividerRow, r.col, '─'.repeat(r.width), { fg: Colors.border, bg: Colors.bgPanel })

    const statsRows: { label: string; value: string; fg?: number }[] = []

    if (detailAgent.model) {
      statsRows.push({ label: 'Model', value: detailAgent.model, fg: Colors.info })
    }

    const status = detailAgent.status
    const statusLabel = status === 'running' ? '● Running'
                       : status === 'done'    ? '✓ Done'
                       : status === 'error'   ? '✗ Error'
                       : '○ Idle'
    const statusFg = statusColor(status)
    statsRows.push({ label: 'Status', value: statusLabel, fg: statusFg })

    // Elapsed time
    if (detailAgent.startTime) {
      const endMs   = detailAgent.endTime ?? Date.now()
      const elapsed = ((endMs - detailAgent.startTime) / 1000).toFixed(1)
      statsRows.push({ label: 'Elapsed', value: `${elapsed}s` })
    }

    // Token stats
    const inp = detailAgent.inputTokens
    const out = detailAgent.outputTokens
    if (inp !== undefined) {
      statsRows.push({ label: 'Input',  value: inp.toLocaleString() + ' tok', fg: Colors.textDim })
      statsRows.push({ label: 'Output', value: (out ?? 0).toLocaleString() + ' tok', fg: Colors.textDim })
      statsRows.push({ label: 'Total',  value: (inp + (out ?? 0)).toLocaleString() + ' tok', fg: Colors.accent })
    }

    if (detailAgent.toolCalls !== undefined) {
      const tc = detailAgent.toolCalls
      const t  = detailAgent.turns ?? 1
      statsRows.push({ label: 'Tools', value: `${tc} call${tc !== 1 ? 's' : ''} / ${t} turn${t !== 1 ? 's' : ''}`, fg: Colors.textDim })
    }

    const labelW = 8
    const maxDetailRows = r.height - listH - 1
    for (let i = 0; i < Math.min(statsRows.length, maxDetailRows); i++) {
      const sr  = statsRows[i]!
      const row = dividerRow + 1 + i
      const lbl = sr.label.padEnd(labelW).substring(0, labelW)
      const val = sr.value.substring(0, r.width - labelW - 2)
      buf.write(row, r.col,          lbl, { fg: Colors.textDim,       bg: Colors.bgPanel })
      buf.write(row, r.col + labelW, val, { fg: sr.fg ?? Colors.text, bg: Colors.bgPanel })
    }
  }

  override onMouse(e: MouseEvent): boolean {
    if (e.button === 'scroll_up') {
      this.selectedIdx = Math.max(0, this.selectedIdx - 1)
      this.onUpdate(); return true
    }
    if (e.button === 'scroll_down') {
      this.selectedIdx = Math.min(this.agents.length - 1, this.selectedIdx + 1)
      this.onUpdate(); return true
    }
    if (e.button !== 'left' || e.action !== 'press') return false
    const r = this.inner
    const clickRow = e.row - r.row
    const listH = Math.min(this.agents.length, LIST_ROWS, Math.max(1, r.height - 6))
    if (clickRow >= 0 && clickRow < listH) {
      this.selectedIdx = this.selectedIdx === clickRow ? -1 : clickRow  // toggle
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
    case 'running': return Colors.accent
    case 'done':    return Colors.success
    case 'error':   return Colors.error
  }
}
