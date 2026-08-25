import { describe, it, expect, afterEach } from 'vitest'
import { Colors, themes, setTheme, activeTheme } from './theme.js'
import { CellBuffer } from './cell-buffer.js'
import { drawBorder } from './layout.js'

afterEach(() => setTheme('default'))

describe('semantic theme tokens', () => {
  it('default theme keeps the historical palette values', () => {
    expect(themes.default.surface).toBe(232)
    expect(themes.default.focus).toBe(75)
    expect(themes.default.primary).toBe(75)
    expect(themes.default.danger).toBe(196)
  })

  it('focus and primary are distinct tokens in high-contrast (gap 18)', () => {
    expect(themes['high-contrast'].focus).not.toBe(themes['high-contrast'].primary)
  })

  it('setTheme mutates the live Colors view in place', () => {
    expect(Colors.border).toBe(240)
    setTheme('high-contrast')
    expect(Colors.border).toBe(255)
    expect(activeTheme()).toBe('high-contrast')
    setTheme('default')
    expect(Colors.border).toBe(240)
  })

  it('high-contrast keeps text/background pairs far apart', () => {
    const t = themes['high-contrast']
    // Pure-black surfaces vs white text — the pairs must never share a value
    for (const fg of [t.text, t.textBright, t.focus, t.danger, t.success]) {
      expect(fg).not.toBe(t.surface)
      expect(fg).not.toBe(t.surfacePanel)
    }
  })

  it('themes render visibly different output for the same scene', () => {
    const render = (): string => {
      const buf = new CellBuffer(10, 40)
      drawBorder(buf, { row: 1, col: 1, height: 6, width: 30 }, 'Panel', true)
      return buf.diff(new CellBuffer(10, 40))
    }
    const before = render()
    setTheme('high-contrast')
    const after = render()
    expect(after).not.toBe(before)
    expect(after).toContain(`38;5;${themes['high-contrast'].focus}m`)
  })
})
