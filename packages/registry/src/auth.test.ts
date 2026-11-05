import { describe, it, expect } from 'vitest'
import { decodeUser } from './auth.js'

function makeJwt(payload: Record<string, unknown>): string {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body    = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.fakesig`
}

describe('decodeUser', () => {
  it('extracts github_handle, email, plan, and id from payload', () => {
    const token = makeJwt({ sub: 'u1', github_handle: 'testuser', email: 'test@example.com', plan: 'pro' })
    const user = decodeUser(token)
    expect(user).not.toBeNull()
    expect(user?.github_handle).toBe('testuser')
    expect(user?.email).toBe('test@example.com')
    expect(user?.plan).toBe('pro')
    expect(user?.id).toBe('u1')
  })

  it('returns null when github_handle is missing', () => {
    const token = makeJwt({ sub: 'u1', email: 'test@example.com' })
    expect(decodeUser(token)).toBeNull()
  })

  it('returns null for malformed token (no dots)', () => {
    expect(decodeUser('notajwt')).toBeNull()
  })

  it('defaults plan to free when missing', () => {
    const token = makeJwt({ sub: 'u1', github_handle: 'foo' })
    expect(decodeUser(token)?.plan).toBe('free')
  })
})
