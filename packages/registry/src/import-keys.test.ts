import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReadFile = vi.fn()
vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}))

describe('importFromTools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear all env vars that match known PROVIDERS
    delete process.env['ANTHROPIC_API_KEY']
    delete process.env['OPENAI_API_KEY']
    delete process.env['CLAUDE_API_KEY']
  })

  it('returns Anthropic candidate when ~/.claude/.credentials.json has primaryApiKey', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ primaryApiKey: 'sk-claude-123' }))

    const { importFromTools } = await import('./import-keys.js')
    const candidates = await importFromTools()

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      configKey: 'anthropic',
      name: 'Anthropic Claude',
      source: '~/.claude/.credentials.json',
      value: 'sk-claude-123',
    })
  })

  it('reads ~/.openclaude/.credentials.json if ~/.claude/.credentials.json fails', async () => {
    // First call fails, second succeeds
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'))
    mockReadFile.mockResolvedValueOnce(JSON.stringify({ primaryApiKey: 'sk-openclaude-456' }))

    const { importFromTools } = await import('./import-keys.js')
    const candidates = await importFromTools()

    expect(candidates).toHaveLength(1)
    expect(candidates[0]?.value).toBe('sk-openclaude-456')
    expect(mockReadFile).toHaveBeenCalledTimes(2)
  })

  it('returns env var candidates for matching PROVIDERS entries', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))
    process.env['OPENAI_API_KEY'] = 'sk-openai-789'
    process.env['ANTHROPIC_API_KEY'] = 'sk-anthropic-xxx'

    const { importFromTools } = await import('./import-keys.js')
    const candidates = await importFromTools()

    expect(candidates.length).toBeGreaterThanOrEqual(2)
    const keys = candidates.map(c => c.configKey).sort()
    expect(keys).toContain('openai')
    expect(keys).toContain('anthropic')
  })

  it('deduplicates when same configKey found in both file and env', async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ primaryApiKey: 'file-anthropic' }))
    process.env['ANTHROPIC_API_KEY'] = 'env-anthropic'

    const { importFromTools } = await import('./import-keys.js')
    const candidates = await importFromTools()

    // Only one anthropic entry (from file, which is checked first)
    const anthropicCandidates = candidates.filter(c => c.configKey === 'anthropic')
    expect(anthropicCandidates).toHaveLength(1)
    expect(anthropicCandidates[0]?.source).toBe('~/.claude/.credentials.json')
  })

  it('returns empty array when no file and no env vars are set', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'))

    const { importFromTools } = await import('./import-keys.js')
    const candidates = await importFromTools()

    expect(candidates).toHaveLength(0)
  })
})
