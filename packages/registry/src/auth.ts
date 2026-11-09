import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

export interface AuthUser {
  id:            string
  github_handle: string
  email:         string
  plan:          string
}

const tokenPath = (): string => join(homedir(), '.agentfactory', 'token')

export async function getToken(): Promise<string | null> {
  try {
    const t = (await readFile(tokenPath(), 'utf8')).trim()
    return t.length > 0 ? t : null
  } catch {
    return null
  }
}

export async function saveToken(token: string): Promise<void> {
  await mkdir(dirname(tokenPath()), { recursive: true })
  await writeFile(tokenPath(), token.trim(), { encoding: 'utf8', mode: 0o600 })
}

export async function clearToken(): Promise<void> {
  try { await unlink(tokenPath()) } catch { /* ENOENT is fine */ }
}

/** Decode JWT payload without verifying — server validates on every request. */
export function decodeUser(token: string): AuthUser | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf8')
    const obj = JSON.parse(payload) as Record<string, unknown>
    const handle = typeof obj['github_handle'] === 'string' ? obj['github_handle'] : null
    if (!handle) return null
    return {
      id:            typeof obj['sub'] === 'string' ? obj['sub'] : typeof obj['id'] === 'string' ? obj['id'] : '',
      github_handle: handle,
      email:         typeof obj['email'] === 'string' ? obj['email'] : '',
      plan:          typeof obj['plan']  === 'string' ? obj['plan']  : 'free',
    }
  } catch {
    return null
  }
}

const apiBase = (): string => process.env['AGENTFACTORY_API_URL'] ?? 'https://api.agentfactory.dev'

/**
 * Current user for the saved token, or null if not logged in.
 *
 * AgentFactory API tokens (`aft_…`, issued by device login) are opaque, so the user comes from
 * `GET /auth/me` with the Bearer token. Older JWT-style tokens are still decoded locally.
 */
export async function getUser(fetchImpl: typeof fetch = fetch): Promise<AuthUser | null> {
  const token = await getToken()
  return token ? userForToken(token, fetchImpl) : null
}

/** Resolve a token to its user: decode legacy JWTs locally, ask `GET /auth/me` for opaque tokens. */
export async function userForToken(token: string, fetchImpl: typeof fetch = fetch): Promise<AuthUser | null> {
  const local = decodeUser(token)
  if (local) return local
  try {
    const res = await fetchImpl(`${apiBase()}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return null
    const u = (await res.json()) as Record<string, unknown>
    if (typeof u['github_handle'] !== 'string') return null
    return {
      id:            typeof u['id'] === 'string' ? u['id'] : '',
      github_handle: u['github_handle'],
      email:         typeof u['email'] === 'string' ? u['email'] : '',
      plan:          typeof u['plan'] === 'string' ? u['plan'] : 'free',
    }
  } catch {
    return null
  }
}
