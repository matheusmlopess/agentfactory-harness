import { describe, it, expect } from 'vitest'
import { decodeUser, userForToken } from './auth.js'

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


describe('userForToken with an opaque API token', () => {
  it('asks /auth/me with the Bearer token', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push([url, init])
      return new Response(JSON.stringify({ id: 'u1', github_handle: 'alice', email: 'a@x', plan: 'pro' }), { status: 200 })
    }) as unknown as typeof fetch
    const user = await userForToken('aft_opaque-token', fake)
    expect(user).toEqual({ id: 'u1', github_handle: 'alice', email: 'a@x', plan: 'pro' })
    expect(calls[0]?.[0]).toMatch(/\/auth\/me$/)
    expect((calls[0]?.[1]?.headers as Record<string, string>)['Authorization']).toBe('Bearer aft_opaque-token')
  })

  it('returns null when the API rejects the token', async () => {
    const fake = (async () => new Response('', { status: 401 })) as unknown as typeof fetch
    expect(await userForToken('aft_revoked', fake)).toBeNull()
  })

  it('still decodes legacy JWT tokens without a request', async () => {
    const fake = (async () => { throw new Error('no request expected') }) as unknown as typeof fetch
    expect((await userForToken(makeJwt({ github_handle: 'bob' }), fake))?.github_handle).toBe('bob')
  })
})
