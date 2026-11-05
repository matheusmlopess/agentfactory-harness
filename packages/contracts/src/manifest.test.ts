import { describe, it, expect } from 'vitest'
import {
  CONTRACT_VERSION, contractMajor, isContractCompatible, isFeatureEnabled,
  type FeatureManifest,
} from './index.js'

const m = (over: Partial<FeatureManifest> = {}): FeatureManifest => ({
  id: 'canvas', contract: CONTRACT_VERSION, ...over,
})

describe('contractMajor', () => {
  it('extracts the major', () => {
    expect(contractMajor('1.2.3')).toBe('1')
    expect(contractMajor('2.0.0')).toBe('2')
    expect(contractMajor('0')).toBe('0')
  })
})

describe('isContractCompatible', () => {
  it('same major is compatible; different major is not', () => {
    expect(isContractCompatible('1.0.0', '1.4.2')).toBe(true)
    expect(isContractCompatible('1.9.9', '1.0.0')).toBe(true)
    expect(isContractCompatible('2.0.0', '1.0.0')).toBe(false)
    expect(isContractCompatible('0.9.0', '1.0.0')).toBe(false)
  })
  it('defaults to the host CONTRACT_VERSION', () => {
    expect(isContractCompatible(CONTRACT_VERSION)).toBe(true)
  })
})

describe('isFeatureEnabled', () => {
  const setting = (val?: string) => (key: string) => (key === 'features.canvas' ? val : undefined)

  it('enabled by default when config is silent', () => {
    expect(isFeatureEnabled(m(), setting(undefined))).toBe(true)
  })
  it('off/false disables', () => {
    expect(isFeatureEnabled(m(), setting('off'))).toBe(false)
    expect(isFeatureEnabled(m(), setting('false'))).toBe(false)
  })
  it('on/true force-enables even against defaultEnabled:false', () => {
    expect(isFeatureEnabled(m({ defaultEnabled: false }), setting('on'))).toBe(true)
    expect(isFeatureEnabled(m({ defaultEnabled: false }), setting('true'))).toBe(true)
  })
  it('defaultEnabled:false disables when config is silent', () => {
    expect(isFeatureEnabled(m({ defaultEnabled: false }), setting(undefined))).toBe(false)
  })
})
