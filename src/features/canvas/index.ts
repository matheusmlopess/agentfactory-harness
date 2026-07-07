import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { OrchestrationCanvas } from './panel.js'
import { PlanSchema, type Plan } from '../../orchestration/schema.js'
import { Executor, type StepEvent } from '../../orchestration/executor.js'
import { studioToPlan, validateStudio } from '../../orchestration/studio-model.js'
import { Session } from '../../core/session.js'
import { agentLoop } from '../../core/agent-loop.js'
import { createAdapter, defaultProvider } from '../../core/llm/index.js'
import { logger } from '../../core/logger.js'
import type { Feature, FeatureCtx } from '../types.js'

const log = logger('CanvasFeature')

/** Cross-feature surface (services key 'plan'): status bar + Ctrl+R use it. */
export interface PlanBridge {
  isRunning(): boolean
  hasPlan(): boolean
  run(): Promise<void>
}

/** Consumers of live run events (the agents dashboard registers this). */
export interface PlanEventSink {
  setPlan(plan: Plan): void
  onPlanEvent(event: StepEvent): void
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

    const sink = ctx?.services.get('plan-events') as PlanEventSink | undefined
    sink?.setPlan(plan)

    try {
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
