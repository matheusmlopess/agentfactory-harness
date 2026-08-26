import { describe, it, expect } from 'vitest'
import { CONTRACT_VERSION, contractMajor, type Feature } from '@factory/contracts/index.js'
import { sessionFeature } from './session/index.js'
import { canvasFeature } from './canvas/index.js'
import { agentsFeature } from './agents/index.js'
import { terminalFeature } from './terminal/index.js'
import { configFeature } from './config/index.js'
import { logsFeature } from './logs/index.js'

const features: Feature[] = [
  sessionFeature(), canvasFeature(), agentsFeature(),
  terminalFeature(), configFeature(), logsFeature(),
]

describe('feature manifests (gap safeguard)', () => {
  it('every feature declares a manifest', () => {
    for (const f of features) expect(f.manifest, `feature ${f.id}`).toBeDefined()
  })

  it('every manifest contract major matches the host CONTRACT_VERSION', () => {
    const host = contractMajor(CONTRACT_VERSION)
    for (const f of features) {
      expect(contractMajor(f.manifest!.contract), `feature ${f.manifest!.id}`).toBe(host)
    }
  })

  it('manifest ids are unique and match the feature id', () => {
    const ids = features.map(f => f.manifest!.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const f of features) expect(f.manifest!.id).toBe(f.id)
  })

  it('provided service keys are unique across features', () => {
    const provided = features.flatMap(f => f.manifest!.provides ?? [])
    expect(new Set(provided).size).toBe(provided.length)
  })
})
