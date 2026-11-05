import { describe, it, expect } from 'vitest'
import { createServiceRegistry, type SessionBridge } from './index.js'

// A minimal stub that satisfies the SessionBridge contract shape.
function stubSession(): SessionBridge {
  return {
    metas: () => [],
    switchTo: () => {},
    switchToId: () => false,
    createSession: () => ({ id: 'x', name: 'x', status: 'idle', active: false, stats: null }),
    resumeById: () => null,
    postMessage: async () => '',
    getSelectedModel: () => null,
    getChatMode: () => false,
    toggleChatMode: () => {},
    openModelPicker: () => {},
    openNewSessionMenu: () => {},
    hasSelection: () => false,
    copySelection: () => {},
    clearSelection: () => {},
  }
}

describe('createServiceRegistry', () => {
  it('returns undefined for an unregistered key (graceful absence)', () => {
    const r = createServiceRegistry()
    expect(r.get('session')).toBeUndefined()
    expect(r.has('session')).toBe(false)
  })

  it('stores and returns a typed provider by key', () => {
    const r = createServiceRegistry()
    const bridge = stubSession()
    r.set('session', bridge)
    expect(r.has('session')).toBe(true)
    expect(r.get('session')).toBe(bridge)
  })

  it('throws on double-registration of the same key', () => {
    const r = createServiceRegistry()
    r.set('session', stubSession())
    expect(() => r.set('session', stubSession())).toThrow(/already registered/)
  })

  it('keeps keys independent', () => {
    const r = createServiceRegistry()
    r.set('plan', { isRunning: () => false, hasPlan: () => false, run: async () => {} })
    expect(r.get('plan')?.isRunning()).toBe(false)
    expect(r.get('session')).toBeUndefined()
    expect(r.get('plan-events')).toBeUndefined()
  })
})
