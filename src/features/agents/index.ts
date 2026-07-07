import { AgentsPanel } from './panel.js'
import type { Feature, FeatureCtx } from '../types.js'
import type { SessionBridge } from '../session/index.js'

export function agentsFeature(): Feature {
  let panel: AgentsPanel | null = null
  let ctx: FeatureCtx | null = null

  /** Push the session list into the panel (was App.refreshAgents). */
  function refresh(): void {
    const bridge = ctx?.services.get('session') as SessionBridge | undefined
    if (!bridge || !panel || panel.mode === 'team') return
    const metas = bridge.metas()
    panel.setAgents(metas.map(m => ({
      name:         m.name,
      status:       m.status,
      active:       m.active,
      ...(m.stats ? {
        model:        m.stats.model,
        inputTokens:  m.stats.inputTokens,
        outputTokens: m.stats.outputTokens,
        toolCalls:    m.stats.toolCalls,
        turns:        m.stats.turns,
        startTime:    m.stats.startTime,
        ...(m.status !== 'running' ? { endTime: Date.now() } : {}),
      } : {}),
    })))
  }

  return {
    id: 'agents',
    tab: {
      id: 'agents',
      title: 'Agents',
      captureMouse: false,
      rectFor: l => l.agents,
      hitVisible: a => a !== 'config' && a !== 'terminal',
      makePanel(c: FeatureCtx) {
        ctx = c
        panel = new AgentsPanel(c.layout().agents, () => c.scheduleRender(),
          (idx) => {
            const bridge = c.services.get('session') as SessionBridge | undefined
            bridge?.switchTo(idx)
            c.render()
          },
        )
        // Live team dashboard: the canvas feature fans run events here
        c.services.set('plan-events', {
          setPlan: (plan) => panel?.setPlan(plan),
          onPlanEvent: (ev) => panel?.onPlanEvent(ev),
        } satisfies import('../canvas/index.js').PlanEventSink)
        return panel
      },
      beforeRender: refresh,
    },
  }
}
