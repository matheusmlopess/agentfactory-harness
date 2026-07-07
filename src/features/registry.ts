import type { Feature } from './types.js'

const features: Feature[] = []

export function registerFeature(f: Feature): void {
  if (features.some(existing => existing.id === f.id)) {
    throw new Error(`Feature already registered: ${f.id}`)
  }
  features.push(f)
}

export function loadedFeatures(): readonly Feature[] {
  return features
}

/** Test helper — clears the registry between cases. */
export function resetFeatures(): void {
  features.length = 0
}
