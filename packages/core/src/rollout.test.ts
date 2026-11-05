import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RolloutStore } from './rollout.js'

let dir: string
let store: RolloutStore

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'rollout-'))
  store = new RolloutStore(dir)
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('RolloutStore', () => {
  it('create() writes a meta line and returns an append handle', () => {
    const h = store.create('Curie', 'claude-opus-4-8')
    expect(h.id).toMatch(/rollout-.*-Curie\.jsonl$/)
    const events = store.load(h.id)
    expect(events[0]).toMatchObject({ type: 'meta', name: 'Curie', model: 'claude-opus-4-8' })
  })

  it('append() persists events in order', () => {
    const h = store.create('Einstein', 'gpt-4o')
    h.append({ type: 'user', text: 'hello' })
    h.append({ type: 'assistant', text: 'hi there' })
    h.append({ type: 'stats', input: 237, output: 27, toolCalls: 0, turns: 1 })
    const ev = store.load(h.id)
    expect(ev.map(e => e.type)).toEqual(['meta', 'user', 'assistant', 'stats'])
    expect(ev[1]).toMatchObject({ type: 'user', text: 'hello' })
    expect(ev[3]).toMatchObject({ type: 'stats', input: 237 })
  })

  it('list() returns saved sessions newest-first', () => {
    store.create('First', 'm1')
    store.create('Second', 'm2')
    const metas = store.list()
    expect(metas.length).toBe(2)
    expect(metas.map(m => m.name).sort()).toEqual(['First', 'Second'])
    expect(metas[0]!.createdAt >= metas[1]!.createdAt).toBe(true)
  })

  it('list() is empty when no sessions exist', () => {
    expect(new RolloutStore(join(dir, 'nope')).list()).toEqual([])
  })

  it('load() returns [] for a missing file', () => {
    expect(store.load(join(dir, 'missing.jsonl'))).toEqual([])
  })

  it('sanitizes unsafe names in the filename', () => {
    const h = store.create('a/b c:d', 'm')
    expect(h.id).toMatch(/rollout-.*-a_b_c_d\.jsonl$/)
  })
})
