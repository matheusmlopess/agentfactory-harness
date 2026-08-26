import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'

export interface AuthUser {
  id:            string
  github_handle: string
  email:         string
  plan:          string
}

const TOKEN_PATH = join(homedir(), '.agentfactory', 'token')

export async function getToken(): Promise<string | null> {
  try {
    const t = (await readFile(TOKEN_PATH, 'utf8')).trim()
    return t.length > 0 ? t : null
  } catch {
    return null
  }
}

export async function saveToken(token: string): Promise<void> {
  await mkdir(dirname(TOKEN_PATH), { recursive: true })
  await writeFile(TOKEN_PATH, token.trim(), { encoding: 'utf8', mode: 0o600 })
}

export async function clearToken(): Promise<void> {
  try { await unlink(TOKEN_PATH) } catch { /* ENOENT is fine */ }
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

/** Convenience: read token from disk and decode. Returns null if not logged in. */
export async function getUser(): Promise<AuthUser | null> {
  const token = await getToken()
  if (!token) return null
  return decodeUser(token)
}
