import { describe, it, expect, beforeEach } from 'vitest'
import { registerFeature, loadedFeatures, resetFeatures } from './registry.js'
import { logsFeature } from './logs/index.js'
import type { Feature, FeatureCtx } from './types.js'
import { ConfigStore } from '../core/config/store.js'
import { computeLayout } from '../tui/renderer/layout.js'

beforeEach(() => resetFeatures())

function makeCtx(): FeatureCtx {
  return {
    scheduleRender: () => {},
    render: () => {},
    store: new ConfigStore(),
    layout: () => computeLayout(24, 80),
    showError: () => {},
    switchTab: () => {},
    services: new Map(),
  }
}

describe('feature registry', () => {
  it('registers and lists features in order', () => {
    const a: Feature = { id: 'a' }
    const b: Feature = { id: 'b' }
    registerFeature(a)
    registerFeature(b)
    expect(loadedFeatures().map(f => f.id)).toEqual(['a', 'b'])
  })

  it('rejects duplicate ids', () => {
    registerFeature({ id: 'dup' })
    expect(() => registerFeature({ id: 'dup' })).toThrow(/already registered/)
  })

  it('resetFeatures clears the registry', () => {
    registerFeature({ id: 'x' })
    resetFeatures()
    expect(loadedFeatures()).toHaveLength(0)
  })
})

describe('logs feature (the registry proving case)', () => {
  it('exposes a logs tab whose panel renders without the host wiring anything', () => {
    const f = logsFeature()
    expect(f.id).toBe('logs')
    expect(f.tab?.captureMouse).toBe(true)
    const panel = f.tab!.makePanel(makeCtx())
    expect(panel.rect).toEqual(computeLayout(24, 80).logs)
    // Keys route like any panel — 'j' (vim down) is Logs-specific and consumed
    expect(panel.onKey({ key: 'j', raw: Buffer.from('j') })).toBe(true)
  })

  it('start/stop lifecycle manages its own heartbeat without throwing', () => {
    const f = logsFeature()
    f.tab!.makePanel(makeCtx())
    f.start?.(makeCtx())
    f.stop?.()
  })
})
