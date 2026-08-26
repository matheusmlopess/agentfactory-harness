import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Planner } from './planner.js'
import { PlanSchema } from './schema.js'

// Mock readline and fs
vi.mock('node:readline', () => ({
  createInterface: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockRejectedValue(new Error('not found')),
}))

import { createInterface } from 'node:readline'
import { writeFile } from 'node:fs/promises'

function makeRl(answers: string[]): ReturnType<typeof createInterface> {
  let i = 0
  return {
    question: (_q: string, cb: (ans: string) => void) => {
      cb(answers[i++] ?? '')
    },
    close: vi.fn(),
  } as unknown as ReturnType<typeof createInterface>
}

describe('Planner.wizard', () => {
  beforeEach(() => {
    vi.mocked(createInterface).mockReset()
    vi.mocked(writeFile).mockReset().mockResolvedValue(undefined)
  })

  it('writes a valid plan file for a single step', async () => {
    vi.mocked(createInterface).mockReturnValue(
      makeRl([
        'my-pipeline', // name
        'fetch',       // step id
        'researcher',  // agent
        'get the data', // prompt
        '',            // dependsOn (blank)
        'n',           // add more?
      ]),
    )

    const planner = new Planner()
    const plan = await planner.wizard('/tmp')

    expect(plan.name).toBe('my-pipeline')
    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]?.id).toBe('fetch')
    expect(PlanSchema.safeParse(plan).success).toBe(true)

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('af-plan.json'),
      expect.stringContaining('"version": "1.0"'),
      'utf8',
    )
  })

  it('builds dependsOn from comma-separated input', async () => {
    vi.mocked(createInterface).mockReturnValue(
      makeRl([
        'pipe',
        'a', 'bot', 'step a', '',
        'y',
        'b', 'bot', 'step b', 'a',
        'n',
      ]),
    )

    const planner = new Planner()
    const plan = await planner.wizard('/tmp')
    expect(plan.steps[1]?.dependsOn).toEqual(['a'])
  })

  it('throws when name is blank', async () => {
    vi.mocked(createInterface).mockReturnValue(makeRl(['']))
    const planner = new Planner()
    await expect(planner.wizard('/tmp')).rejects.toThrow('required')
  })
})
