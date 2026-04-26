import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import { Colors } from '../renderer/theme.js'

export interface AgentEntry {
  name: string
  status: 'idle' | 'running' | 'done' | 'error'
}

export class AgentsPanel extends Panel {
  private agents: AgentEntry[] = []

  constructor(rect: Rect) {
    super(rect)
  }

  setAgents(agents: AgentEntry[]): void {
    this.agents = agents
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
      const badge = statusBadge(agent.status)
      const line = `${badge} ${agent.name}`.substring(0, r.width)
      buf.write(r.row + i, r.col, line, { fg: statusColor(agent.status), bg: Colors.bgPanel })
    }
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
