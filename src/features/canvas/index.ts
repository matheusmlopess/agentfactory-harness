import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { OrchestrationCanvas, type CanvasSessionActions } from './panel.js'
import { PlanSchema, type Plan, type Step } from '@factory/orchestration/schema.js'
import { Executor, type StepEvent } from '@factory/orchestration/executor.js'
import { studioToPlan, validateStudio } from '@factory/orchestration/studio-model.js'
import { Session } from '@factory/core/session.js'
import { agentLoop } from '@factory/core/agent-loop.js'
import { createAdapter, defaultProvider } from '@factory/core/llm/index.js'
import { logger } from '@factory/core/logger.js'
import type {
  Feature, FeatureCtx, SessionBridge, PlanBridge, PlanEventSink,
} from '@factory/contracts/index.js'

// PlanBridge / PlanEventSink now live in contracts/services; re-export for
// back-compat with any existing importer.
export type { PlanBridge, PlanEventSink } from '@factory/contracts/index.js'

const log = logger('CanvasFeature')

export function canvasFeature(): Feature {
  let panel: OrchestrationCanvas | null = null
  let ctx: FeatureCtx | null = null
  let currentPlan: Plan | null = null
  let planRunning = false

  /** Resolved lazily — the session feature registers its bridge on startup. */
  const sessionBridge = (): SessionBridge | undefined =>
    ctx?.services.get('session')

  /** Legacy fallback: run a step in a throwaway, invisible session (used
   *  only when no session bridge is registered, e.g. headless tests). */
  async function throwawayRun(step: Step): Promise<string> {
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
  }

  /** Run a step inside a real, visible session bound to its canvas node —
   *  the step appears in the Agents list and its transcript is inspectable. */
  async function boundSessionRun(bridge: SessionBridge, step: Step): Promise<string> {
    const node = panel?.getModel().nodes.find(n => n.id === step.id)
    let sid = node?.sessionId
    if (sid === undefined || !bridge.metas().some(m => m.id === sid)) {
      const model = step.model !== undefined
        ? { provider: step.provider ?? defaultProvider(), id: step.model, label: step.model }
        : bridge.getSelectedModel()
      sid = bridge.createSession(step.id, model).id
      if (node) panel?.bindSession(node.id, sid)
    }
    return bridge.postMessage(sid, step.prompt)
  }

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

  /** Serialize the canvas model when it has content; falls back to the
   *  last-loaded file plan. Fatal design issues block the run. */
  function planFromCanvas(): Plan | null {
    if (!panel || panel.getModel().nodes.length === 0) return currentPlan
    const issues = validateStudio(panel.getModel()).filter(i => i.fatal)
    if (issues.length > 0) {
      ctx?.showError(`Plan invalid: ${issues[0]!.message}`)
      return null
    }
    return studioToPlan(panel.getModel())
  }

  async function savePlan(): Promise<void> {
    const plan = planFromCanvas()
    if (!plan || !ctx) return
    const file = resolve(process.cwd(), 'af-plan.json')
    try {
      await writeFile(file, JSON.stringify(plan, null, 2) + '\n', 'utf8')
      currentPlan = plan
      log.info('plan saved', { file, steps: plan.steps.length })
      ctx.render()
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  async function runPlan(): Promise<void> {
    if (planRunning || !panel) return
    const plan = planFromCanvas()
    if (!plan) return
    currentPlan = plan
    planRunning = true

    const sink = ctx?.services.get('plan-events')
    sink?.setPlan(plan)

    try {
      panel.syncFromPlan(plan)

      const executor = new Executor(plan, {
        agentRunner: async (step) => {
          const bridge = sessionBridge()
          return bridge ? boundSessionRun(bridge, step) : throwawayRun(step)
        },
      })

      for await (const event of executor.run()) {
        panel.applyStepEvent(event)
        sink?.onPlanEvent(event)
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
        const sessionActions: CanvasSessionActions = {
          listSessions: () => (sessionBridge()?.metas() ?? [])
            .map(m => ({ id: m.id, name: m.name, active: m.active })),
          createSessionFor: (name) => {
            const b = sessionBridge()
            if (!b) return null
            return b.createSession(name, b.getSelectedModel()).id
          },
          openSession: (sessionId) => {
            const b = sessionBridge()
            if (!b) return null
            let opened: string | null = null
            if (b.switchToId(sessionId)) {
              opened = sessionId
            } else {
              // Not loaded — try resuming the saved rollout (fresh id)
              const resumed = b.resumeById(sessionId)
              if (!resumed) return null
              opened = resumed.id
            }
            c.switchTab('session')
            return opened
          },
        }
        panel = new OrchestrationCanvas(c.layout().canvas, () => c.scheduleRender(), sessionActions)
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
        { id: 'run-plan',  label: 'Run Plan',              hint: 'Ctrl+R', action: () => { void runPlan() } },
        { id: 'save-plan', label: 'Save Plan (af-plan.json)', hint: 'Ctrl+S', action: () => { void savePlan() } },
      ]
    },
    keybindings() {
      return [
        {
          id: 'plan.run', keys: ['ctrl+r'], description: 'Run the canvas plan', panelFirst: true,
          run: () => { void runPlan() },
        },
        {
          id: 'plan.save', keys: ['ctrl+s'], when: 'orchestration' as const,
          description: 'Save the canvas to af-plan.json',
          run: () => { void savePlan() },
        },
      ]
    },
    start(c: FeatureCtx) {
      ctx = c
      void tryLoadPlan()
    },
  }
}
