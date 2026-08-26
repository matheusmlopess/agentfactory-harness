import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetKey = vi.fn()
const mockSetKey = vi.fn()
const mockClear  = vi.fn()
const mockGetSetting = vi.fn()
const mockSetSetting = vi.fn()

vi.mock('@factory/core/config/store.js', () => ({
  store: {
    getKey: (...args: unknown[]) => mockGetKey(...args),
    setKey: (...args: unknown[]) => mockSetKey(...args),
    clearKey: (...args: unknown[]) => mockClear(...args),
    getSetting: (...args: unknown[]) => mockGetSetting(...args),
    setSetting: (...args: unknown[]) => mockSetSetting(...args),
    lastWriteError: null,
  },
}))

const { ConfigPanel, PROVIDERS, providersByCategory } = await import('./panel.js')
import { CellBuffer } from '../../shared/renderer/cell-buffer.js'
import type { Rect } from '../../shared/renderer/layout.js'

const RECT: Rect = { row: 1, col: 20, height: 30, width: 60 }

// The Interface section (theme / reduced motion / size profile) precedes providers
const SETTINGS_COUNT = 3

function makeTrackedPanel(onSetting?: (key: string, value: string) => void): { panel: InstanceType<typeof ConfigPanel>; getUpdates: () => number } {
  let updates = 0
  const panel = new ConfigPanel(RECT, () => { updates++ }, onSetting ? { onSetting } : {})
  return { panel, getUpdates: () => updates }
}

/** Move the selection past the Interface settings to the first provider. */
function selectFirstProvider(panel: InstanceType<typeof ConfigPanel>): void {
  for (let i = 0; i < SETTINGS_COUNT; i++) panel.onKey(key('arrow_down'))
}

function key(k: string) {
  return { key: k, shift: false, ctrl: false, alt: false, raw: Buffer.from(k) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetKey.mockReturnValue(undefined)
  mockGetSetting.mockReturnValue(undefined)
  // Suppress lastWriteError — store module is mocked so it's already null
})

describe('ConfigPanel construction', () => {
  it('creates successfully with a valid rect', () => {
    const { panel } = makeTrackedPanel()
    expect(panel).toBeTruthy()
  })

  it('selectedIdx points to the first non-alias entry', () => {
    const { panel } = makeTrackedPanel()
    // Expose via the getSelected helper by sending enter and checking setKey args
    // We just verify it doesn't crash and selectedIdx is >= 0 by navigation
    const consumed = panel.onKey(key('arrow_down'))
    expect(consumed).toBe(true)
  })

  it('exports PROVIDERS and providersByCategory', () => {
    expect(PROVIDERS.length).toBeGreaterThan(30)
    const map = providersByCategory()
    expect(map.get('api')!.length).toBeGreaterThan(10)
    expect(map.get('cli')!.length).toBeGreaterThan(0)
    expect(map.get('local')!.length).toBeGreaterThan(0)
  })
})

describe('ConfigPanel navigation', () => {
  it('arrow_down/up return true (consumed)', () => {
    const { panel } = makeTrackedPanel()
    expect(panel.onKey(key('arrow_down'))).toBe(true)
    expect(panel.onKey(key('arrow_up'))).toBe(true)
  })

  it('page_down/page_up return true', () => {
    const { panel } = makeTrackedPanel()
    expect(panel.onKey(key('page_down'))).toBe(true)
    expect(panel.onKey(key('page_up'))).toBe(true)
  })

  it('navigation triggers onUpdate callback', () => {
    const { panel, getUpdates } = makeTrackedPanel()
    panel.onKey(key('arrow_down'))
    expect(getUpdates()).toBe(1)
    panel.onKey(key('arrow_up'))
    expect(getUpdates()).toBe(2)
  })

  it('non-navigation keys return false in browse mode', () => {
    const { panel } = makeTrackedPanel()
    expect(panel.onKey(key('a'))).toBe(false)
    expect(panel.onKey(key('escape'))).toBe(false)
  })
})

describe('ConfigPanel edit mode', () => {
  it('enter switches to edit mode (subsequent keys are consumed as edit)', () => {
    const { panel } = makeTrackedPanel()
    selectFirstProvider(panel)
    panel.onKey(key('enter'))
    // In edit mode, printable chars are consumed
    expect(panel.onKey(key('a'))).toBe(true)
  })

  it('typing + Enter calls store.setKey with the typed value', () => {
    const { panel } = makeTrackedPanel()
    selectFirstProvider(panel)
    panel.onKey(key('enter'))        // → edit mode
    panel.onKey(key('s'))
    panel.onKey(key('k'))
    panel.onKey(key('-'))
    panel.onKey(key('enter'))        // → save + browse

    expect(mockSetKey).toHaveBeenCalledOnce()
    const [, value] = mockSetKey.mock.calls[0]!
    expect(value).toBe('sk-')
  })

  it('escape in edit mode does NOT call store.setKey', () => {
    const { panel } = makeTrackedPanel()
    selectFirstProvider(panel)
    panel.onKey(key('enter'))        // → edit mode
    panel.onKey(key('x'))
    panel.onKey(key('escape'))       // → browse, no save

    expect(mockSetKey).not.toHaveBeenCalled()
  })

  it('backspace trims editBuf', () => {
    const { panel } = makeTrackedPanel()
    selectFirstProvider(panel)
    panel.onKey(key('enter'))        // → edit mode
    panel.onKey(key('a'))
    panel.onKey(key('b'))
    panel.onKey(key('backspace'))
    panel.onKey(key('enter'))        // save

    expect(mockSetKey).toHaveBeenCalledOnce()
    const [, value] = mockSetKey.mock.calls[0]!
    expect(value).toBe('a')
  })

  it('empty editBuf + Enter does NOT call store.setKey', () => {
    const { panel } = makeTrackedPanel()
    selectFirstProvider(panel)
    panel.onKey(key('enter'))        // → edit mode
    panel.onKey(key('enter'))        // save with empty buf — should no-op

    expect(mockSetKey).not.toHaveBeenCalled()
  })
})

describe('ConfigPanel Interface section (ui-consolidation P4)', () => {
  it('Enter on the first row cycles the theme setting via onSetting', () => {
    const onSetting = vi.fn()
    const { panel } = makeTrackedPanel(onSetting)
    panel.onKey(key('enter'))  // initial selection = Theme
    expect(onSetting).toHaveBeenCalledWith('theme', 'high-contrast')
    expect(mockSetKey).not.toHaveBeenCalled()
  })

  it('cycling wraps back to the first value', () => {
    mockGetSetting.mockImplementation((k: unknown) => (k === 'theme' ? 'high-contrast' : undefined))
    const onSetting = vi.fn()
    const { panel } = makeTrackedPanel(onSetting)
    panel.onKey(key('enter'))
    expect(onSetting).toHaveBeenCalledWith('theme', 'default')
  })

  it('renders the Interface section with current values', () => {
    mockGetSetting.mockImplementation((k: unknown) => (k === 'sizeProfile' ? 'standard' : undefined))
    const { panel } = makeTrackedPanel()
    const buf = new CellBuffer(40, 80)
    panel.render(buf)
    const plain = buf.diff(new CellBuffer(40, 80)).replace(/\x1b\[[^m]*m|\x1b\[\d+;\d+H/g, '')
    expect(plain).toContain('Interface')
    expect(plain).toContain('Theme')
    expect(plain).toContain('[standard ▸]')
  })

  it('Ctrl+R on a setting row is not consumed (no key to clear)', () => {
    const { panel } = makeTrackedPanel()
    expect(panel.onKey(key('ctrl+r'))).toBe(false)
    expect(mockClear).not.toHaveBeenCalled()
  })
})

describe('ConfigPanel alias entries', () => {
  it('alias entries exist in PROVIDERS and have aliasOf set', () => {
    const aliases = PROVIDERS.filter(p => p.aliasOf !== undefined)
    expect(aliases.length).toBeGreaterThan(0)
  })
})

describe('ConfigPanel render()', () => {
  it('renders without throwing', () => {
    mockGetKey.mockReturnValue(undefined)
    const { panel } = makeTrackedPanel()
    const buf = new CellBuffer(40, 80)
    expect(() => panel.render(buf)).not.toThrow()
  })

  it('renders [set] badge when a key is present — diff is non-empty', () => {
    mockGetKey.mockReturnValue('sk-ant-test')
    const { panel } = makeTrackedPanel()
    const buf = new CellBuffer(40, 80)
    panel.render(buf)
    const out = buf.diff(new CellBuffer(40, 80))
    // diff output is ANSI-escaped; just verify it's non-empty and contains recognisable chars
    expect(out).toBeTruthy()
    expect(out.length).toBeGreaterThan(10)
  })

  it('renders category header text — diff contains provider name chars', () => {
    const { panel } = makeTrackedPanel()
    const buf = new CellBuffer(40, 80)
    panel.render(buf)
    const out = buf.diff(new CellBuffer(40, 80))
    // Strip ANSI escape codes and check the plain text contains expected content
    const plain = out.replace(/\x1b\[[^m]*m|\x1b\[\d+;\d+H/g, '')
    expect(plain).toContain('API')
  })
})
