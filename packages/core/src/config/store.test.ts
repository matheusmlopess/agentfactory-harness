import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs/promises before importing store
const mockReadFile  = vi.fn()
const mockWriteFile = vi.fn()
const mockMkdir     = vi.fn()

vi.mock('node:fs/promises', () => ({
  readFile:  (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir:     (...args: unknown[]) => mockMkdir(...args),
}))

// Import after mocking
const { ConfigStore } = await import('./store.js')

beforeEach(() => {
  vi.clearAllMocks()
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
})

describe('ConfigStore.init()', () => {
  it('loads keys and urls from a well-formed config file', async () => {
    const data = { keys: { anthropic: 'sk-ant-123' }, urls: { ollama: 'http://localhost:11434' } }
    mockReadFile.mockResolvedValue(JSON.stringify(data))

    const s = new ConfigStore()
    await s.init()

    expect(s.getKey('anthropic')).toBe('sk-ant-123')
    expect(s.getKey('ollama')).toBe('http://localhost:11434')
  })

  it('is idempotent — second call does not re-read the file', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ keys: {}, urls: {} }))

    const s = new ConfigStore()
    await s.init()
    await s.init()

    expect(mockReadFile).toHaveBeenCalledTimes(1)
  })

  it('silently produces empty config when file does not exist (ENOENT)', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    mockReadFile.mockRejectedValue(err)

    const s = new ConfigStore()
    await s.init()

    expect(s.getKey('anthropic')).toBeUndefined()
    expect(s.lastWriteError).toBeNull()
  })

  it('records read error in lastWriteError when JSON is malformed', async () => {
    mockReadFile.mockResolvedValue('not-json{{{')

    const s = new ConfigStore()
    await s.init()

    expect(s.lastWriteError).toMatch(/config read/)
  })
})

describe('ConfigStore.getKey()', () => {
  it('returns the file value when present, ignoring env var', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ keys: { anthropic: 'file-key' }, urls: {} }))
    process.env['ANTHROPIC_API_KEY'] = 'env-key'

    const s = new ConfigStore()
    await s.init()

    expect(s.getKey('anthropic', 'ANTHROPIC_API_KEY')).toBe('file-key')

    delete process.env['ANTHROPIC_API_KEY']
  })

  it('falls back to env var when file has no value', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ keys: {}, urls: {} }))
    process.env['ANTHROPIC_API_KEY'] = 'env-only'

    const s = new ConfigStore()
    await s.init()

    expect(s.getKey('anthropic', 'ANTHROPIC_API_KEY')).toBe('env-only')

    delete process.env['ANTHROPIC_API_KEY']
  })

  it('returns undefined when neither file nor env has a value', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ keys: {}, urls: {} }))
    delete process.env['ANTHROPIC_API_KEY']

    const s = new ConfigStore()
    await s.init()

    expect(s.getKey('anthropic', 'ANTHROPIC_API_KEY')).toBeUndefined()
  })
})

describe('ConfigStore.setKey()', () => {
  it('stores apikey in keys bucket and triggers a write', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ keys: {}, urls: {} }))

    const s = new ConfigStore()
    await s.init()
    s.setKey('anthropic', 'sk-new', 'apikey')

    await vi.waitFor(() => expect(mockWriteFile).toHaveBeenCalledOnce())
    const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string) as Record<string, unknown>
    expect((written['keys'] as Record<string, string>)['anthropic']).toBe('sk-new')
  })

  it('stores url in urls bucket and removes any key entry', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ keys: { ollama: 'old' }, urls: {} }))

    const s = new ConfigStore()
    await s.init()
    s.setKey('ollama', 'http://localhost:11434', 'url')

    await vi.waitFor(() => expect(mockWriteFile).toHaveBeenCalledOnce())
    const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string) as Record<string, unknown>
    expect((written['urls'] as Record<string, string>)['ollama']).toBe('http://localhost:11434')
    expect((written['keys'] as Record<string, string>)['ollama']).toBeUndefined()
  })
})

describe('ConfigStore.clearKey()', () => {
  it('removes the key from both buckets and writes', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ keys: { anthropic: 'sk-old' }, urls: {} }))

    const s = new ConfigStore()
    await s.init()
    s.clearKey('anthropic')

    await vi.waitFor(() => expect(mockWriteFile).toHaveBeenCalledOnce())
    const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string) as Record<string, unknown>
    expect((written['keys'] as Record<string, string>)['anthropic']).toBeUndefined()
  })
})

describe('ConfigStore settings (ui-consolidation P2)', () => {
  it('get/set roundtrip and persistence', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ keys: {}, urls: {}, settings: { theme: 'default' } }))

    const s = new ConfigStore()
    await s.init()
    expect(s.getSetting('theme')).toBe('default')

    s.setSetting('theme', 'high-contrast')
    expect(s.getSetting('theme')).toBe('high-contrast')

    await vi.waitFor(() => expect(mockWriteFile).toHaveBeenCalledOnce())
    const written = JSON.parse(mockWriteFile.mock.calls[0]![1] as string) as Record<string, unknown>
    expect((written['settings'] as Record<string, string>)['theme']).toBe('high-contrast')
  })

  it('legacy config file without settings parses to empty settings', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ keys: { anthropic: 'x' }, urls: {} }))

    const s = new ConfigStore()
    await s.init()
    expect(s.getSetting('theme')).toBeUndefined()
    expect(s.getKey('anthropic')).toBe('x')
  })
})
