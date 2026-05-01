import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Executor } from './executor.js'
import type { Plan, Step } from './schema.js'
import type { StepEvent } from './executor.js'

type PartialStep = { id: string; agent?: string; prompt?: string; dependsOn?: string[] }

function makePlan(steps: PartialStep[]): Plan {
  return {
    version: '1.0',
    name: 'test',
    steps: steps.map((s) => ({
      id: s.id,
      agent: s.agent ?? 'bot',
      prompt: s.prompt ?? `run ${s.id}`,
      dependsOn: s.dependsOn ?? [],
    })),
  }
}

async function collect(exec: Executor): Promise<StepEvent[]> {
  const events: StepEvent[] = []
  for await (const e of exec.run()) events.push(e)
  return events
}

const stubRunner = vi.fn(async (_step: Step) => 'ok')

describe('Executor', () => {
  beforeEach(() => { stubRunner.mockReset().mockResolvedValue('ok') })

  it('runs a single step and emits plan:done', async () => {
    const exec = new Executor(makePlan([{ id: 'a' }]), { agentRunner: stubRunner })
    const events = await collect(exec)
    expect(events.map((e) => e.type)).toContain('step:start')
    expect(events.map((e) => e.type)).toContain('step:done')
    expect(events.at(-1)?.type).toBe('plan:done')
  })

  it('runs parallel steps concurrently', async () => {
    const order: string[] = []
    const runner = async (step: Step) => {
      order.push(`start:${step.id}`)
      await new Promise((r) => setTimeout(r, 10))
      order.push(`end:${step.id}`)
      return 'ok'
    }
    const exec = new Executor(makePlan([{ id: 'a' }, { id: 'b' }]), { agentRunner: runner })
    await collect(exec)
    // Both should start before either ends
    expect(order.indexOf('start:a')).toBeLessThan(order.indexOf('end:b'))
    expect(order.indexOf('start:b')).toBeLessThan(order.indexOf('end:a'))
  })

  it('runs dependent chain in order', async () => {
    const order: string[] = []
    const runner = async (step: Step) => {
      order.push(step.id)
      return step.id
    }
    const plan = makePlan([{ id: 'a' }, { id: 'b', dependsOn: ['a'] }, { id: 'c', dependsOn: ['b'] }])
    const exec = new Executor(plan, { agentRunner: runner })
    await collect(exec)
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('skips dependents when a step errors', async () => {
    const runner = async (step: Step) => {
      if (step.id === 'a') throw new Error('boom')
      return 'ok'
    }
    const plan = makePlan([{ id: 'a' }, { id: 'b', dependsOn: ['a'] }])
    const exec = new Executor(plan, { agentRunner: runner })
    const events = await collect(exec)
    const types = Object.fromEntries(events.filter((e) => e.stepId).map((e) => [e.stepId, e.type]))
    expect(types['a']).toBe('step:error')
    expect(types['b']).toBe('step:skipped')
  })

  it('continues non-dependent steps after a failure', async () => {
    const runner = async (step: Step) => {
      if (step.id === 'fail') throw new Error('x')
      return 'ok'
    }
    const plan = makePlan([{ id: 'fail' }, { id: 'independent' }])
    const exec = new Executor(plan, { agentRunner: runner })
    const events = await collect(exec)
    const types = Object.fromEntries(events.filter((e) => e.stepId).map((e) => [e.stepId, e.type]))
    expect(types['fail']).toBe('step:error')
    expect(types['independent']).toBe('step:done')
  })

  it('respects maxConcurrency=1 (serial execution)', async () => {
    const running: string[] = []
    let maxParallel = 0
    const runner = async (step: Step) => {
      running.push(step.id)
      maxParallel = Math.max(maxParallel, running.length)
      await new Promise((r) => setTimeout(r, 5))
      running.splice(running.indexOf(step.id), 1)
      return 'ok'
    }
    const plan = makePlan([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    const exec = new Executor(plan, { maxConcurrency: 1, agentRunner: runner })
    await collect(exec)
    expect(maxParallel).toBe(1)
  })

  it('interpolates {{stepId}} tokens in prompts', async () => {
    const seenPrompts: string[] = []
    const runner = async (step: Step) => {
      seenPrompts.push(step.prompt)
      return `result-${step.id}`
    }
    const plan: Plan = {
      version: '1.0',
      name: 'interp',
      steps: [
        { id: 'a', agent: 'bot', prompt: 'get data', dependsOn: [] },
        { id: 'b', agent: 'bot', prompt: 'summarise {{a}}', dependsOn: ['a'] },
      ],
    }
    const exec = new Executor(plan, { agentRunner: runner })
    await collect(exec)
    expect(seenPrompts[1]).toBe('summarise result-a')
  })

  it('emits plan:done as the last event', async () => {
    const exec = new Executor(makePlan([{ id: 'x' }, { id: 'y' }]), { agentRunner: stubRunner })
    const events = await collect(exec)
    expect(events.at(-1)?.type).toBe('plan:done')
  })

  it('throws on cyclic plan in constructor', () => {
    const plan: Plan = {
      version: '1.0',
      name: 'cycle',
      steps: [
        { id: 'a', agent: 'x', prompt: 'p', dependsOn: ['b'] },
        { id: 'b', agent: 'x', prompt: 'p', dependsOn: ['a'] },
      ],
    }
    expect(() => new Executor(plan, { agentRunner: stubRunner })).toThrow(/cycle/i)
  })
})
