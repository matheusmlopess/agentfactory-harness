import { describe, it, expect, vi, beforeEach } from 'vitest'

// Deterministic rollout ids, no homedir writes
let rolloutSeq = 0
vi.mock('../../core/rollout.js', () => ({
  rolloutStore: {
    create: vi.fn((name: string) => ({
      id: `/fake/rollouts/${name}-${++rolloutSeq}.jsonl`,
      append: vi.fn(),
    })),
    list: vi.fn(() => [
      { id: '/fake/rollouts/saved-1.jsonl', name: 'Saved', model: 'default', createdAt: '2026-07-08T00:00:00Z' },
    ]),
    load: vi.fn(() => [
      { type: 'user', text: 'hello' },
      { type: 'assistant', text: 'hi there' },
    ]),
  },
}))

// Scripted agent loop: streams two deltas, no network
vi.mock('../../core/agent-loop.js', () => ({
  // eslint-disable-next-line @typescript-eslint/require-await
  agentLoop: vi.fn(async function* () {
    yield { type: 'text_delta', delta: 'final ' }
    yield { type: 'text_delta', delta: 'answer' }
    yield { type: 'turn_end' }
  }),
}))

vi.mock('../../core/hooks.js', () => ({ runHook: vi.fn(async () => {}) }))

vi.mock('../../core/llm/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/llm/index.js')>()
  return {
    ...actual,
    defaultProvider: () => 'anthropic' as const,
    createAdapter: vi.fn(() => ({ defaultModel: 'fake-model' })),
  }
})

import { SessionPanel } from './panel.js'

function makePanel(): SessionPanel {
  return new SessionPanel({ row: 1, col: 0, height: 30, width: 60 }, () => {})
}

describe('SessionPanel — session identity', () => {
  beforeEach(() => { rolloutSeq = 0 })

  it('every session meta carries a unique stable id', () => {
    const p = makePanel()
    p.createSession('agent-1')
    p.createSession('agent-2')
    const metas = p.sessionMetas()
    expect(metas).toHaveLength(3)
    expect(new Set(metas.map(m => m.id)).size).toBe(3)
    for (const m of metas) expect(m.id).toMatch(/^\/fake\/rollouts\//)
  })

  it('createSession does not steal focus from the active session', () => {
    const p = makePanel()
    const activeBefore = p.sessionMetas().find(m => m.active)!
    const meta = p.createSession('agent-1')
    expect(meta.name).toBe('agent-1')
    expect(meta.active).toBe(false)
    expect(p.sessionMetas().find(m => m.active)!.id).toBe(activeBefore.id)
  })

  it('switchToId activates a loaded session and returns false for unknown ids', () => {
    const p = makePanel()
    const meta = p.createSession('agent-1')
    expect(p.switchToId(meta.id)).toBe(true)
    expect(p.sessionMetas().find(m => m.active)!.id).toBe(meta.id)
    expect(p.switchToId('/nope')).toBe(false)
  })

  it('resumeById replays a saved rollout into a NEW active session', () => {
    const p = makePanel()
    const meta = p.resumeById('/fake/rollouts/saved-1.jsonl')
    expect(meta).not.toBeNull()
    expect(meta!.name).toBe('Saved*')                      // resumed marker
    expect(meta!.active).toBe(true)
    expect(meta!.id).not.toBe('/fake/rollouts/saved-1.jsonl')  // fresh id
    expect(p.resumeById('/unknown')).toBeNull()
  })
})

describe('SessionPanel — postMessage', () => {
  beforeEach(() => { rolloutSeq = 0 })

  it('resolves with the accumulated assistant text', async () => {
    const p = makePanel()
    const meta = p.createSession('agent-1')
    await expect(p.postMessage(meta.id, 'do the thing')).resolves.toBe('final answer')
    expect(p.sessionMetas().find(m => m.id === meta.id)!.status).toBe('done')
  })

  it('rejects for an unknown session id', async () => {
    const p = makePanel()
    await expect(p.postMessage('/nope', 'x')).rejects.toThrow(/No session/)
  })

  it('rejects when the session is already streaming', async () => {
    const p = makePanel()
    const meta = p.createSession('agent-1')
    const first = p.postMessage(meta.id, 'one')            // starts streaming
    await expect(p.postMessage(meta.id, 'two')).rejects.toThrow(/busy/)
    await first
  })
})
