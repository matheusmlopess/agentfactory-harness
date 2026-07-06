import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getVersion } from './version.js'

describe('getVersion', () => {
  it('matches package.json version exactly (single source of truth)', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    expect(getVersion()).toBe(pkg.version)
    expect(getVersion()).not.toBe('0.0.0')
  })

  it('is cached (same reference on repeat calls)', () => {
    expect(getVersion()).toBe(getVersion())
  })
})
