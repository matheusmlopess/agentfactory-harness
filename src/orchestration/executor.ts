import type { Plan, Step } from './schema.js'
import { toposort, readySet } from './graph.js'

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

export interface StepEvent {
  type: 'step:start' | 'step:done' | 'step:error' | 'step:skipped' | 'plan:done'
  stepId: string
  status: StepStatus
  output?: string
  error?: string
  durationMs?: number
}

export type AgentRunnerFn = (
  step: Step,
  inputs: Record<string, string>,
) => Promise<string>

export interface ExecutorOptions {
  maxConcurrency?: number
  agentRunner: AgentRunnerFn
}

function interpolate(prompt: string, inputs: Record<string, string>): string {
  return prompt.replace(/\{\{([a-z0-9_-]+)\}\}/g, (_, id: string) => inputs[id] ?? '')
}

/** Collect all step ids that transitively depend on any of the given failed ids. */
function transitiveDependents(failedIds: Set<string>, steps: Step[]): Set<string> {
  const result = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    for (const step of steps) {
      if (result.has(step.id) || failedIds.has(step.id)) continue
      if (step.dependsOn.some((d) => failedIds.has(d) || result.has(d))) {
        result.add(step.id)
        changed = true
      }
    }
  }
  return result
}

export class Executor {
  private readonly plan: Plan
  private readonly opts: Required<ExecutorOptions>

  constructor(plan: Plan, opts: ExecutorOptions) {
    // validate order is possible (throws on cycle)
    toposort(plan.steps)
    this.plan = plan
    this.opts = { maxConcurrency: 3, ...opts }
  }

  async *run(): AsyncIterable<StepEvent> {
    const { steps } = this.plan
    const { maxConcurrency, agentRunner } = this.opts

    const outputs = new Map<string, string>()
    const completed = new Set<string>()
    const failed = new Set<string>()
    const running = new Set<string>()
    const emitted = new Set<string>()

    // Yield events via a queue so we can interleave concurrent step results
    const queue: StepEvent[] = []

    function enqueue(e: StepEvent): void {
      queue.push(e)
    }

    async function runStep(step: Step): Promise<void> {
      running.add(step.id)
      const inputs: Record<string, string> = {}
      for (const dep of step.dependsOn) {
        const out = outputs.get(dep)
        if (out !== undefined) inputs[dep] = out
      }
      const prompt = interpolate(step.prompt, inputs)

      enqueue({ type: 'step:start', stepId: step.id, status: 'running' })
      const start = Date.now()

      try {
        const output = await agentRunner({ ...step, prompt }, inputs)
        outputs.set(step.id, output)
        completed.add(step.id)
        running.delete(step.id)
        enqueue({
          type: 'step:done',
          stepId: step.id,
          status: 'done',
          output,
          durationMs: Date.now() - start,
        })
      } catch (err) {
        failed.add(step.id)
        running.delete(step.id)
        enqueue({
          type: 'step:error',
          stepId: step.id,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        })
      }
    }

    const stepMap = new Map(steps.map((s) => [s.id, s]))
    const inFlight: Promise<void>[] = []

    // Drive until all steps are resolved
    while (emitted.size < steps.length) {
      // Flush queued events
      while (queue.length > 0) {
        yield queue.shift()!
      }

      // Compute skip set from current failures
      const skipSet = transitiveDependents(failed, steps)

      // Emit skips for newly-skippable steps
      for (const id of skipSet) {
        if (!emitted.has(id) && !running.has(id)) {
          emitted.add(id)
          completed.add(id) // treat skip as resolved for readySet
          enqueue({ type: 'step:skipped', stepId: id, status: 'skipped' })
        }
      }

      // Mark failed and completed as emitted
      for (const id of [...completed, ...failed]) {
        emitted.add(id)
      }

      if (emitted.size >= steps.length) break

      // Dispatch ready steps up to maxConcurrency
      const ready = readySet(steps, completed)
      for (const id of ready) {
        if (emitted.has(id) || running.has(id)) continue
        if (running.size >= maxConcurrency) break
        const step = stepMap.get(id)!
        const p = runStep(step).then(() => {
          inFlight.splice(inFlight.indexOf(p), 1)
        })
        inFlight.push(p)
      }

      if (inFlight.length === 0 && queue.length === 0) break

      // Wait for at least one in-flight step to finish
      if (inFlight.length > 0) {
        await Promise.race(inFlight)
      }
    }

    // Final flush
    while (queue.length > 0) {
      yield queue.shift()!
    }

    yield { type: 'plan:done', stepId: '', status: 'done' }
  }
}
