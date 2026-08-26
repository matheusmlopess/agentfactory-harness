import { readFileSync } from 'node:fs'

let cached: string | null = null

/**
 * Single source of truth for the app version: the root app package.json
 * (name "agentfactory-harness"). Walks up from this module so it works from
 * dist/ (bundled build, one level below root) AND from packages/core/src
 * (tsx dev, several levels below root in the workspace layout).
 */
export function getVersion(): string {
  if (cached !== null) return cached
  const rels = [
    '../package.json',          // dist/index.js -> root
    '../../package.json',
    '../../../package.json',     // packages/core/src -> root
    '../../../../package.json',
  ]
  for (const rel of rels) {
    try {
      const url = new URL(rel, import.meta.url)
      const pkg = JSON.parse(readFileSync(url, 'utf8')) as { name?: string; version?: string }
      if (pkg.name === 'agentfactory-harness' && typeof pkg.version === 'string') {
        cached = pkg.version
        return cached
      }
    } catch {
      // try the next candidate
    }
  }
  cached = '0.0.0'
  return cached
}
