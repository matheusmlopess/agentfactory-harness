import { listModels, type Provider, type ModelEntry } from './index.js'

interface CacheEntry {
  at: number
  models: ModelEntry[]
}

const cache = new Map<string, CacheEntry>()
const DEFAULT_TTL_MS = 5 * 60 * 1000

/**
 * TTL cache in front of listModels (J3 latency): the model picker re-opens
 * instantly instead of re-fetching the provider catalog every time.
 */
export async function cachedListModels(provider: Provider, apiKey?: string, ttlMs: number = DEFAULT_TTL_MS): Promise<ModelEntry[]> {
  const key = `${provider}:${apiKey ?? ''}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.models
  const models = await listModels(provider, apiKey)
  cache.set(key, { at: Date.now(), models })
  return models
}

/** Test helper. */
export function clearModelCache(): void {
  cache.clear()
}
