import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetToken = vi.fn()
vi.mock('./auth.js', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('registryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env['AGENTFACTORY_API_URL']
  })

  it('attaches Bearer token when getToken returns a value', async () => {
    mockGetToken.mockResolvedValue('token-123')
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'ok' }),
      text: async () => '{}',
    })

    const { registryClient } = await import('./client.js')
    await registryClient.get('/test')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [_, opts] = mockFetch.mock.calls[0]!
    expect((opts as RequestInit).headers).toMatchObject({
      'Authorization': 'Bearer token-123',
    })
  })

  it('omits Authorization header when getToken returns null', async () => {
    mockGetToken.mockResolvedValue(null)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'ok' }),
      text: async () => '{}',
    })

    const { registryClient } = await import('./client.js')
    await registryClient.get('/test')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [_, opts] = mockFetch.mock.calls[0]!
    expect((opts as RequestInit).headers).not.toHaveProperty('Authorization')
  })

  it('sends POST with JSON body and method', async () => {
    mockGetToken.mockResolvedValue(null)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'u1' }),
      text: async () => '{}',
    })

    const { registryClient } = await import('./client.js')
    await registryClient.post('/users', { name: 'Alice' })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0]!
    expect((opts as RequestInit).method).toBe('POST')
    expect((opts as RequestInit).body).toBe('{"name":"Alice"}')
  })

  it('throws Error with status and text on non-ok response', async () => {
    mockGetToken.mockResolvedValue(null)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })

    const { registryClient } = await import('./client.js')
    await expect(() => registryClient.get('/secure')).rejects.toThrow('registry 401: Unauthorized')
  })

  it('uses default API_BASE when env var not set', async () => {
    mockGetToken.mockResolvedValue(null)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => '{}',
    })

    const { registryClient } = await import('./client.js')
    await registryClient.get('/test')

    const [url] = mockFetch.mock.calls[0]!
    expect(url as string).toContain('https://api.agentfactory.dev/test')
  })

  it('sends DELETE method for delete()', async () => {
    mockGetToken.mockResolvedValue(null)
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => '{}',
    })

    const { registryClient } = await import('./client.js')
    await registryClient.delete('/resource/1')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [_, opts] = mockFetch.mock.calls[0]!
    expect((opts as RequestInit).method).toBe('DELETE')
  })
})
