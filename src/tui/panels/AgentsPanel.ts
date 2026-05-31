import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import type { MouseEvent } from '../input/mouse.js'
import { Colors } from '../renderer/theme.js'

export interface AgentEntry {
  name: string
  status: 'idle' | 'running' | 'done' | 'error'
}

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

    for (let i = 0; i < Math.min(this.agents.length, r.height); i++) {
      const agent = this.agents[i]
      if (!agent) continue
      const selected = i === this.selectedIdx
      const badge = statusBadge(agent.status)
      const line = `${badge} ${agent.name}`.padEnd(r.width).substring(0, r.width)
      const bg = selected ? Colors.bgActive : Colors.bgPanel
      const fg = selected ? Colors.textBright : statusColor(agent.status)
      buf.write(r.row + i, r.col, line, { fg, bg, bold: selected })
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
    if (clickRow >= 0 && clickRow < this.agents.length) {
      this.selectedIdx = clickRow
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
