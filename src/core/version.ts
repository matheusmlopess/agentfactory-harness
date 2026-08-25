import { readFileSync } from 'node:fs'

let cached: string | null = null

/**
 * Single source of truth for the app version: package.json.
 * Resolves relative to this module so it works both from src/ (tsx dev,
 * two levels below the package root) and from dist/ (bundled build, one
 * level below).
 */
export function getVersion(): string {
  if (cached !== null) return cached
  for (const rel of ['../package.json', '../../package.json']) {
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
