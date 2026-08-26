import { AgentsPanel } from './panel.js'
import type { Feature, FeatureCtx } from '@factory/contracts/index.js'

export function agentsFeature(): Feature {
  let panel: AgentsPanel | null = null
  let ctx: FeatureCtx | null = null

  /** Push the session list into the panel (was App.refreshAgents). */
  function refresh(): void {
    const bridge = ctx?.services.get('session')
    if (!bridge || !panel || panel.mode === 'team') return
    const metas = bridge.metas()
    panel.setAgents(metas.map(m => ({
      id:           m.id,
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
            const bridge = c.services.get('session')
            bridge?.switchTo(idx)
            // Clicking an agent OPENS its session: move focus to the Session
            // tab so the conversation is immediately interactive.
            c.switchTab('session')
          },
        )
        // Live team dashboard: the canvas feature fans run events here.
        // Value shape is checked against ServiceMap['plan-events'] by set().
        c.services.set('plan-events', {
          setPlan: (plan) => panel?.setPlan(plan),
          onPlanEvent: (ev) => panel?.onPlanEvent(ev),
        })
        return panel
      },
      beforeRender: refresh,
    },
  }
}
