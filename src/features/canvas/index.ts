import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { OrchestrationCanvas } from '../../tui/panels/OrchestrationCanvas.js'
import { PlanSchema, type Plan } from '../../orchestration/schema.js'
import { Executor } from '../../orchestration/executor.js'
import { Session } from '../../core/session.js'
import { agentLoop } from '../../core/agent-loop.js'
import { createAdapter, defaultProvider } from '../../core/llm/index.js'
import type { Feature, FeatureCtx } from '../types.js'

/** Cross-feature surface (services key 'plan'): status bar + Ctrl+R use it. */
export interface PlanBridge {
  isRunning(): boolean
  hasPlan(): boolean
  run(): Promise<void>
}

export function canvasFeature(): Feature {
  let panel: OrchestrationCanvas | null = null
  let ctx: FeatureCtx | null = null
  let currentPlan: Plan | null = null
  let planRunning = false

  async function tryLoadPlan(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(resolve(process.cwd(), 'af-plan.json'), 'utf8'))
      const plan = PlanSchema.parse(raw)
      currentPlan = plan
      panel?.syncFromPlan(plan)
    } catch (err) {
      const isNoFile = err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
      if (!isNoFile) {
        ctx?.showError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  async function runPlan(): Promise<void> {
    if (!currentPlan || planRunning || !panel) return
    planRunning = true

    try {
      const plan = currentPlan
      panel.syncFromPlan(plan)

      const executor = new Executor(plan, {
        agentRunner: async (step) => {
          const provider = step.provider ?? defaultProvider()
          const adapter = createAdapter(provider)
          const session = new Session()
          session.addMessage({ role: 'user', content: step.prompt })
          let out = ''
          for await (const e of agentLoop(session, {
            adapter,
            ...(step.model !== undefined ? { model: step.model } : {}),
          })) {
            if (e.type === 'text_delta') out += e.delta
          }
          return out.trim()
        },
      })

      for await (const event of executor.run()) {
        panel.applyStepEvent(event)
      }
    } finally {
      planRunning = false
    }
  }

  return {
    id: 'orchestration',
    tab: {
      id: 'orchestration',
      title: 'Orchestration',
      captureMouse: false,
      rectFor: l => l.canvas,
      hitVisible: a => a !== 'config' && a !== 'terminal',
      makePanel(c: FeatureCtx) {
        ctx = c
        panel = new OrchestrationCanvas(c.layout().canvas, () => c.scheduleRender())
        const bridge: PlanBridge = {
          isRunning: () => planRunning,
          hasPlan: () => currentPlan !== null,
          run: () => runPlan(),
        }
        c.services.set('plan', bridge)
        return panel
      },
    },
    commands() {
      return [
        { id: 'run-plan', label: 'Run Plan', hint: 'Ctrl+R', action: () => { void runPlan() } },
      ]
    },
    keybindings() {
      return [
        {
          id: 'plan.run', keys: ['ctrl+r'], description: 'Run the loaded plan', panelFirst: true,
          run: () => { void runPlan() },
        },
      ]
    },
    start(c: FeatureCtx) {
      ctx = c
      void tryLoadPlan()
    },
  }
}
