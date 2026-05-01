import { describe, it, expect } from 'vitest'
import { PlanSchema, StepSchema } from './schema.js'

const validStep = {
  id: 'fetch',
  agent: 'web-researcher',
  prompt: 'Fetch the docs',
  dependsOn: [],
}

const validPlan = {
  version: '1.0' as const,
  name: 'my-pipeline',
  steps: [validStep],
}

describe('StepSchema', () => {
  it('accepts a valid step', () => {
    expect(() => StepSchema.parse(validStep)).not.toThrow()
  })

  it('rejects id with spaces', () => {
    const result = StepSchema.safeParse({ ...validStep, id: 'bad id' })
    expect(result.success).toBe(false)
  })

  it('rejects empty agent', () => {
    const result = StepSchema.safeParse({ ...validStep, agent: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty prompt', () => {
    const result = StepSchema.safeParse({ ...validStep, prompt: '' })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive timeout', () => {
    const result = StepSchema.safeParse({ ...validStep, timeout: 0 })
    expect(result.success).toBe(false)
  })

  it('accepts positive timeout', () => {
    expect(() => StepSchema.parse({ ...validStep, timeout: 30000 })).not.toThrow()
  })

  it('defaults dependsOn to empty array', () => {
    const s = StepSchema.parse({ id: 'a', agent: 'x', prompt: 'p' })
    expect(s.dependsOn).toEqual([])
  })
})

describe('PlanSchema', () => {
  it('accepts a valid plan', () => {
    expect(() => PlanSchema.parse(validPlan)).not.toThrow()
  })

  it('rejects wrong version', () => {
    const result = PlanSchema.safeParse({ ...validPlan, version: '2.0' })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = PlanSchema.safeParse({ ...validPlan, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty steps array', () => {
    const result = PlanSchema.safeParse({ ...validPlan, steps: [] })
    expect(result.success).toBe(false)
  })

  it('rejects duplicate step ids', () => {
    const result = PlanSchema.safeParse({
      ...validPlan,
      steps: [validStep, { ...validStep, prompt: 'other' }],
    })
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).toContain('Duplicate step id')
  })

  it('rejects unknown dependsOn ref', () => {
    const result = PlanSchema.safeParse({
      ...validPlan,
      steps: [{ ...validStep, dependsOn: ['does-not-exist'] }],
    })
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).toContain('unknown dependsOn ref')
  })

  it('accepts valid dependsOn chain', () => {
    const plan = PlanSchema.parse({
      version: '1.0',
      name: 'chain',
      steps: [
        { id: 'a', agent: 'x', prompt: 'p1', dependsOn: [] },
        { id: 'b', agent: 'y', prompt: 'p2', dependsOn: ['a'] },
      ],
    })
    expect(plan.steps[1]?.dependsOn).toEqual(['a'])
  })
})
