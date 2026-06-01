import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { PROVIDERS } from '../core/config/providers.js'

export interface ImportCandidate {
  configKey: string
  name:      string
  source:    string
  value:     string
}

async function readClaudeCodeKey(): Promise<string | null> {
  for (const p of [
    join(homedir(), '.claude',     '.credentials.json'),
    join(homedir(), '.openclaude', '.credentials.json'),
  ]) {
    try {
      const raw = JSON.parse(await readFile(p, 'utf8')) as Record<string, unknown>
      if (typeof raw['primaryApiKey'] === 'string' && raw['primaryApiKey'].length > 0) {
        return raw['primaryApiKey']
      }
    } catch { /* file absent or unreadable */ }
  }
  return null
}

/**
 * Scan installed CLI tool config files and environment variables for known API keys.
 * Returns candidates for user confirmation before writing to the config store.
 */
export async function importFromTools(): Promise<ImportCandidate[]> {
  const candidates: ImportCandidate[] = []
  const seen = new Set<string>()

  // 1. Claude Code / OpenClaude credentials file → Anthropic key
  const claudeKey = await readClaudeCodeKey()
  if (claudeKey) {
    candidates.push({ configKey: 'anthropic', name: 'Anthropic Claude', source: '~/.claude/.credentials.json', value: claudeKey })
    seen.add('anthropic')
  }

  // 2. Environment variables for all known non-alias providers
  for (const p of PROVIDERS) {
    if (!p.envVar || p.aliasOf !== undefined || seen.has(p.configKey)) continue
    const val = process.env[p.envVar]
    if (val && val.length > 0) {
      candidates.push({ configKey: p.configKey, name: p.name, source: `$${p.envVar}`, value: val })
      seen.add(p.configKey)
    }
  }

  return candidates
}
