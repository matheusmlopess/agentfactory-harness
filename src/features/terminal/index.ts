import { TerminalPanel } from './panel.js'
import type { Feature, FeatureCtx } from '@factory/contracts/index.js'
import { CONTRACT_VERSION } from '@factory/contracts/index.js'

/**
 * Terminal tab. makePanel is invoked lazily by the host on first access —
 * preserving VT-GAP-08 (PTY spawns only on first switch to the tab).
 */
export function terminalFeature(): Feature {
  let panel: TerminalPanel | null = null

  return {
    id: 'terminal',
    manifest: { id: 'terminal', contract: CONTRACT_VERSION },
    tab: {
      id: 'terminal',
      title: 'Terminal',
      captureMouse: false,
      rectFor: l => l.terminal,
      hitVisible: a => a === 'terminal',
      makePanel(ctx: FeatureCtx) {
        panel = new TerminalPanel(ctx.layout().terminal, () => ctx.scheduleRender())
        return panel
      },
    },
    stop() {
      panel?.destroy()
      panel = null
    },
  }
}
