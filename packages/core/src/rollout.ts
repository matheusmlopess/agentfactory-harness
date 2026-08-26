import { mkdirSync, appendFileSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Append-only JSONL session persistence, modelled on OpenAI Codex's rollout
 * files. Each session is one file under
 *   ~/.config/agentfactory/sessions/YYYY-MM-DD/rollout-<ts>-<name>.jsonl
 * with one event per line. Resume = replay the file.
 */
export type RolloutEvent =
  | { type: 'meta';      name: string; model: string; createdAt: string }
  | { type: 'user';      text: string }
  | { type: 'assistant'; text: string }
  | { type: 'system';    text: string }
  | { type: 'tool';      name: string; result?: string }
  | { type: 'stats';     input: number; output: number; toolCalls: number; turns: number }

export interface RolloutMeta {
  id:        string   // absolute file path (the rollout id)
  name:      string
  model:     string
  createdAt: string
}

/** A live handle to one rollout file — append events as the session progresses. */
export interface RolloutHandle {
  id: string
  append(event: RolloutEvent): void
}

function sessionsRoot(): string {
  return join(homedir(), '.config', 'agentfactory', 'sessions')
}

export class RolloutStore {
  private root: string

  constructor(root = sessionsRoot()) {
    this.root = root
  }

  /** Open a new rollout file and write its meta line. Returns an append handle. */
  create(name: string, model: string): RolloutHandle {
    const now = new Date()
    const day = now.toISOString().slice(0, 10)                 // YYYY-MM-DD
    const ts  = now.toISOString().replace(/[:.]/g, '-')
    const dir = join(this.root, day)
    const path = join(dir, `rollout-${ts}-${sanitize(name)}.jsonl`)
    try {
      mkdirSync(dir, { recursive: true })
      writeFileSync(path, '', 'utf8')
    } catch { /* best-effort persistence — never break the session */ }

    const handle: RolloutHandle = {
      id: path,
      append: (event) => {
        try { appendFileSync(path, JSON.stringify(event) + '\n', 'utf8') } catch { /* ignore */ }
      },
    }
    handle.append({ type: 'meta', name, model, createdAt: now.toISOString() })
    return handle
  }

  /** List all saved sessions (newest first), reading each file's meta line. */
  list(): RolloutMeta[] {
    const out: RolloutMeta[] = []
    if (!existsSync(this.root)) return out
    for (const day of safeReaddir(this.root)) {
      const dayDir = join(this.root, day)
      for (const file of safeReaddir(dayDir)) {
        if (!file.endsWith('.jsonl')) continue
        const path = join(dayDir, file)
        const meta = this.readMeta(path)
        if (meta) out.push(meta)
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  /** Read all events from a rollout file (for resume). */
  load(id: string): RolloutEvent[] {
    try {
      return readFileSync(id, 'utf8')
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as RolloutEvent)
    } catch {
      return []
    }
  }

  private readMeta(path: string): RolloutMeta | null {
    try {
      const first = readFileSync(path, 'utf8').split('\n', 1)[0] ?? ''
      const obj = JSON.parse(first) as RolloutEvent
      if (obj.type === 'meta') return { id: path, name: obj.name, model: obj.model, createdAt: obj.createdAt }
    } catch { /* skip unreadable */ }
    return null
  }
}

function sanitize(name: string): string {
  return name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40) || 'session'
}

function safeReaddir(dir: string): string[] {
  try { return readdirSync(dir) } catch { return [] }
}

export const rolloutStore = new RolloutStore()
