import { describe, it, expect } from 'vitest'
import { toposort, detectCycles, readySet } from './graph.js'
import type { Step } from './schema.js'

function step(id: string, dependsOn: string[] = []): Step {
  return { id, agent: 'x', prompt: 'p', dependsOn }
}

describe('toposort', () => {
  it('returns single step unchanged', () => {
    expect(toposort([step('a')])).toEqual(['a'])
  })

  it('returns linear chain in order', () => {
    const result = toposort([step('b', ['a']), step('a')])
    expect(result.indexOf('a')).toBeLessThan(result.indexOf('b'))
  })

  it('handles diamond DAG', () => {
    // a → b, a → c, b → d, c → d
    const steps = [step('d', ['b', 'c']), step('b', ['a']), step('c', ['a']), step('a')]
    const order = toposort(steps)
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'))
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'))
  })

  it('throws on self-cycle', () => {
    expect(() => toposort([step('a', ['a'])])).toThrow(/cycle/i)
  })

  it('throws on 3-node cycle', () => {
    const steps = [step('a', ['c']), step('b', ['a']), step('c', ['b'])]
    expect(() => toposort(steps)).toThrow(/cycle/i)
  })

  it('handles isolated nodes', () => {
    const result = toposort([step('x'), step('y'), step('z')])
    expect(result).toHaveLength(3)
    expect(result).toContain('x')
  })
})

describe('detectCycles', () => {
  it('returns empty for acyclic plan', () => {
    expect(detectCycles([step('a'), step('b', ['a'])])).toEqual([])
  })

  it('detects self-cycle', () => {
    const cycles = detectCycles([step('a', ['a'])])
    expect(cycles.length).toBeGreaterThan(0)
    expect(cycles[0]).toContain('a')
  })

  it('detects 2-node mutual cycle', () => {
    const cycles = detectCycles([step('a', ['b']), step('b', ['a'])])
    expect(cycles.length).toBeGreaterThan(0)
  })

  it('returns empty for single node', () => {
    expect(detectCycles([step('a')])).toEqual([])
  })
})

describe('readySet', () => {
  it('returns all steps with no deps when completed is empty', () => {
    const steps = [step('a'), step('b'), step('c', ['a'])]
    const ready = readySet(steps, new Set())
    expect(ready).toContain('a')
    expect(ready).toContain('b')
    expect(ready).not.toContain('c')
  })

  it('unlocks dependent when dep completes', () => {
    const steps = [step('a'), step('b', ['a'])]
    const ready = readySet(steps, new Set(['a']))
    expect(ready).toContain('b')
    expect(ready).not.toContain('a')
  })

  it('does not include already-completed steps', () => {
    const steps = [step('a'), step('b', ['a'])]
    const ready = readySet(steps, new Set(['a', 'b']))
    expect(ready.size).toBe(0)
  })

  it('handles diamond: both mid-steps ready when root complete', () => {
    const steps = [step('a'), step('b', ['a']), step('c', ['a']), step('d', ['b', 'c'])]
    const ready = readySet(steps, new Set(['a']))
    expect(ready).toContain('b')
    expect(ready).toContain('c')
    expect(ready).not.toContain('d')
  })
})
