import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getVersion } from './version.js'

describe('getVersion', () => {
  it('matches the root app package.json version (single source of truth)', () => {
    // packages/core/src -> repo root is three levels up
    const pkg = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as { name: string; version: string }
    expect(pkg.name).toBe('agentfactory-harness')
    expect(getVersion()).toBe(pkg.version)
    expect(getVersion()).not.toBe('0.0.0')
  })

  it('is cached (same reference on repeat calls)', () => {
    expect(getVersion()).toBe(getVersion())
  })
})
