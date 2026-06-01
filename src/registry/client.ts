import { getToken } from './auth.js'

const API_BASE = process.env['AGENTFACTORY_API_URL'] ?? 'https://api.agentfactory.dev'

interface ReqOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

async function request<T>(path: string, opts: ReqOptions = {}): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const init: RequestInit = { method: opts.method ?? 'GET', headers }
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body)
  if (opts.signal !== undefined) init.signal = opts.signal
  const res = await fetch(`${API_BASE}${path}`, init)

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`registry ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

export const registryClient = {
  get:    <T>(path: string, opts?: ReqOptions)                     => request<T>(path, opts),
  post:   <T>(path: string, body: unknown, opts?: ReqOptions)      => request<T>(path, { ...opts, method: 'POST', body }),
  put:    <T>(path: string, body: unknown, opts?: ReqOptions)      => request<T>(path, { ...opts, method: 'PUT',  body }),
  delete: <T>(path: string, opts?: ReqOptions)                     => request<T>(path, { ...opts, method: 'DELETE' }),
}
