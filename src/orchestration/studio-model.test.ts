import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  studioToPlan, planToStudio, validateStudio, deriveView, emptyModel,
  type StudioModel,
} from './studio-model.js'
import { PlanSchema } from './schema.js'

function threeNodeModel(): StudioModel {
  return {
    name: 'demo',
    nodes: [
      { id: 'plan', kind: 'agent', row: 0, col: 0, agent: 'planner', prompt: 'Plan the work' },
      { id: 'build', kind: 'agent', row: 0, col: 26, agent: 'worker', prompt: 'Build it' },
      { id: 'review', kind: 'agent', row: 8, col: 0, agent: 'reviewer', prompt: 'Review {{build}}' },
    ],
    edges: [
      { id: 'plan→build', from: 'plan', to: 'build', kind: 'handoff', payload: 'summary' },
      { id: 'build→review', from: 'build', to: 'review', kind: 'handoff', payload: 'full' },
      { id: 'plan→review', from: 'plan', to: 'review', kind: 'dependency' },
    ],
  }
}

describe('studio-model purity', () => {
  it('imports nothing from shared/ or features/ (web-renderer reusable)', () => {
    const src = readFileSync(new URL('./studio-model.ts', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from '.*shared\//)
    expect(src).not.toMatch(/from '.*features\//)
  })
})

describe('studioToPlan', () => {
  it('produces a PlanSchema-valid plan the executor can run', () => {
    const plan = studioToPlan(threeNodeModel())
    expect(() => PlanSchema.parse(plan)).not.toThrow()
    expect(plan.steps.map(s => s.id)).toEqual(['plan', 'build', 'review'])
    // Both edge kinds become dependsOn ordering
    expect(plan.steps[1]!.dependsOn).toEqual(['plan'])
    expect(plan.steps[2]!.dependsOn.sort()).toEqual(['build', 'plan'])
  })

  it('appends the handoff input scaffold when the prompt lacks the marker', () => {
    const plan = studioToPlan(threeNodeModel())
    // build's prompt had no {{plan}} → scaffold appended
    expect(plan.steps[1]!.prompt).toContain('Input from plan:\n{{plan}}')
    // review already contains {{build}} → not duplicated
    expect(plan.steps[2]!.prompt.match(/\{\{build\}\}/g)).toHaveLength(1)
    // dependency edges never inject prompt scaffolds
    expect(plan.steps[2]!.prompt).not.toContain('{{plan}}')
  })

  it('carries layout + typed edges in x-studio', () => {
    const plan = studioToPlan(threeNodeModel())
    expect(plan['x-studio']!.layout['build']).toEqual({ row: 0, col: 26 })
    expect(plan['x-studio']!.edges).toHaveLength(3)
    expect(plan['x-studio']!.edges[0]).toEqual({ from: 'plan', to: 'build', kind: 'handoff', payload: 'summary' })
  })
})

describe('planToStudio', () => {
  it('round-trips losslessly: planToStudio(studioToPlan(m)) preserves ids/layout/edges', () => {
    const m = threeNodeModel()
    const back = planToStudio(studioToPlan(m))
    expect(back.name).toBe(m.name)
    expect(back.nodes.map(n => [n.id, n.row, n.col])).toEqual(m.nodes.map(n => [n.id, n.row, n.col]))
    expect(back.edges).toEqual(m.edges)
  })

  it('is stable: a second round-trip is identical (scaffold not re-appended)', () => {
    const once = studioToPlan(threeNodeModel())
    const twice = studioToPlan(planToStudio(once))
    expect(twice).toEqual(once)
  })

  it('round-trips node session bindings via x-studio.sessions', () => {
    const m = threeNodeModel()
    m.nodes[0]!.sessionId = '/tmp/rollouts/plan.jsonl'
    m.nodes[2]!.sessionId = '/tmp/rollouts/review.jsonl'
    const plan = studioToPlan(m)
    expect(plan['x-studio']!.sessions).toEqual({
      plan: '/tmp/rollouts/plan.jsonl',
      review: '/tmp/rollouts/review.jsonl',
    })
    const back = planToStudio(plan)
    expect(back.nodes[0]!.sessionId).toBe('/tmp/rollouts/plan.jsonl')
    expect(back.nodes[1]!.sessionId).toBeUndefined()   // unbound stays absent
    expect(back.nodes[2]!.sessionId).toBe('/tmp/rollouts/review.jsonl')
  })

  it('keeps a session binding when the node is renamed before serializing', () => {
    const m = threeNodeModel()
    m.nodes[0]!.sessionId = '/tmp/rollouts/plan.jsonl'
    // Simulate the inspector rename flow: id changes, edges remap
    m.nodes[0]!.id = 'architect'
    for (const e of m.edges) {
      if (e.from === 'plan') e.from = 'architect'
      if (e.to === 'plan') e.to = 'architect'
      e.id = `${e.from}→${e.to}`
    }
    const plan = studioToPlan(m)
    expect(plan['x-studio']!.sessions).toEqual({ architect: '/tmp/rollouts/plan.jsonl' })
    expect(planToStudio(plan).nodes[0]!.sessionId).toBe('/tmp/rollouts/plan.jsonl')
  })

  it('loads a legacy plan without x-studio: auto-grid layout + dependency edges', () => {
    const legacy = PlanSchema.parse({
      version: '1.0',
      name: 'legacy',
      steps: [
        { id: 'a', agent: 'x', prompt: 'p' },
        { id: 'b', agent: 'y', prompt: 'q', dependsOn: ['a'] },
      ],
    })
    const m = planToStudio(legacy)
    expect(m.nodes[0]).toMatchObject({ id: 'a', row: 0, col: 0 })
    expect(m.nodes[1]).toMatchObject({ id: 'b', row: 0, col: 26 })
    expect(m.edges).toEqual([{ id: 'a→b', from: 'a', to: 'b', kind: 'dependency' }])
  })
})

describe('validateStudio', () => {
  it('accepts a valid model', () => {
    expect(validateStudio(threeNodeModel()).filter(i => i.fatal)).toEqual([])
  })

  it('flags empty model, dup ids, bad id pattern, empty prompt/agent', () => {
    expect(validateStudio(emptyModel()).some(i => i.fatal)).toBe(true)
    const m = threeNodeModel()
    m.nodes.push({ id: 'plan', kind: 'agent', row: 0, col: 0, agent: 'x', prompt: 'y' })
    expect(validateStudio(m).some(i => i.message.includes('Duplicate'))).toBe(true)
    const bad: StudioModel = {
      name: 'x',
      nodes: [{ id: 'Bad ID!', kind: 'agent', row: 0, col: 0, agent: '', prompt: '' }],
      edges: [],
    }
    const issues = validateStudio(bad)
    expect(issues.some(i => i.message.includes('must match'))).toBe(true)
    expect(issues.some(i => i.message.includes('no agent'))).toBe(true)
    expect(issues.some(i => i.message.includes('empty prompt'))).toBe(true)
  })

  it('flags dangling edges and cycles', () => {
    const m = threeNodeModel()
    m.edges.push({ id: 'x', from: 'ghost', to: 'plan', kind: 'dependency' })
    expect(validateStudio(m).some(i => i.message.includes('missing node'))).toBe(true)

    const cyclic = threeNodeModel()
    cyclic.edges.push({ id: 'c', from: 'review', to: 'plan', kind: 'dependency' })
    expect(validateStudio(cyclic).some(i => i.message.startsWith('Cycle'))).toBe(true)
  })
})

describe('deriveView', () => {
  it('maps nodes to blocks and edges to typed wires (input ports always on)', () => {
    const { blocks, wires } = deriveView(threeNodeModel())
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ id: 'plan', title: 'plan', status: 'idle', inputs: ['in'], outputs: ['out'] })
    expect(blocks[1]!.inputs).toEqual(['in'])
    expect(wires[0]).toMatchObject({ fromBlockId: 'plan', toBlockId: 'build', kind: 'handoff', payload: 'summary' })
  })

  it('applies run statuses including pending/skipped', () => {
    const { blocks } = deriveView(threeNodeModel(), { plan: 'done', build: 'error', review: 'skipped' })
    expect(blocks.map(b => b.status)).toEqual(['done', 'error', 'skipped'])
  })
})
