import { describe, it, expect, vi } from 'vitest'
import { fuzzyScore, CommandPalette } from './CommandPalette.js'
import type { PaletteCommand } from './CommandPalette.js'

// Minimal CellBuffer stub
class StubBuf {
  cells: Record<string, string> = {}
  write(row: number, col: number, text: string): void {
    for (let i = 0; i < text.length; i++) {
      this.cells[`${row},${col + i}`] = text[i]!
    }
  }
  fill(): void {}
  diff(): string { return '' }
  clone(): this { return this }
}

function makeCommands(n = 3): PaletteCommand[] {
  return Array.from({ length: n }, (_, i) => ({
    id:     `cmd-${i}`,
    label:  `Command ${i}`,
    hint:   `F${i + 1}`,
    action: vi.fn(),
  }))
}

// ── fuzzyScore ───────────────────────────────────────────────────────────────

describe('fuzzyScore', () => {
  it('empty query → 3 (show all)', () => {
    expect(fuzzyScore('Switch to Terminal', '')).toBe(3)
  })

  it('case-insensitive substring match → 2', () => {
    expect(fuzzyScore('Switch to Terminal', 'terminal')).toBe(2)
    expect(fuzzyScore('Switch to Terminal', 'SWITCH')).toBe(2)
  })

  it('subsequence match → 1', () => {
    expect(fuzzyScore('Switch to Terminal', 'stt')).toBe(1)
    expect(fuzzyScore('Run Plan', 'rp')).toBe(1)
  })

  it('no match → 0', () => {
    expect(fuzzyScore('Switch to Terminal', 'xyz')).toBe(0)
  })
})

// ── CommandPalette ────────────────────────────────────────────────────────────

describe('CommandPalette', () => {
  it('isOpen is false before openPalette()', () => {
    const cp = new CommandPalette(makeCommands())
    expect(cp.isOpen).toBe(false)
  })

  it('isOpen is true after openPalette()', () => {
    const cp = new CommandPalette(makeCommands())
    cp.openPalette()
    expect(cp.isOpen).toBe(true)
  })

  it('render() draws the border and query row', () => {
    const cp  = new CommandPalette(makeCommands())
    cp.openPalette()
    const buf = new StubBuf()
    cp.render(buf as never, 40, 80)
    // top-left corner present somewhere in cells
    const chars = Object.values(buf.cells).join('')
    expect(chars).toContain('┌')
    expect(chars).toContain('>')
  })

  it('render() shows (no matches) when query filters everything out', () => {
    const cp  = new CommandPalette(makeCommands())
    cp.openPalette()
    // type something that matches nothing
    cp.onKey({ key: 'z' } as never)
    cp.onKey({ key: 'z' } as never)
    cp.onKey({ key: 'z' } as never)
    const buf = new StubBuf()
    cp.render(buf as never, 40, 80)
    const chars = Object.values(buf.cells).join('')
    expect(chars).toContain('no matches')
  })

  it('onKey arrow_down advances selection', () => {
    const cmds = makeCommands(4)
    const cp = new CommandPalette(cmds)
    cp.openPalette()
    expect(cp.onKey({ key: 'arrow_down' } as never)).toBe('consumed')
    // trigger enter on second item
    cp.onKey({ key: 'enter' } as never)
    expect(cmds[1]!.action).toHaveBeenCalled()
  })

  it('onKey arrow_down clamps at last visible item', () => {
    const cp = new CommandPalette(makeCommands(2))
    cp.openPalette()
    cp.onKey({ key: 'arrow_down' } as never)
    cp.onKey({ key: 'arrow_down' } as never) // beyond end — should clamp
    cp.onKey({ key: 'enter' } as never)
    // still on item index 1 (last)
    // just verify no throw; selection stays in bounds
  })

  it('onKey arrow_up clamps at 0', () => {
    const cp = new CommandPalette(makeCommands(3))
    cp.openPalette()
    expect(cp.onKey({ key: 'arrow_up' } as never)).toBe('consumed')
    // no throw, selection stays at 0
  })

  it('onKey printable char appends to query and resets selection', () => {
    const cmds = makeCommands(3)
    const cp = new CommandPalette(cmds)
    cp.openPalette()
    cp.onKey({ key: 'arrow_down' } as never)
    cp.onKey({ key: 'c' } as never)
    // selection reset → enter fires item 0
    cp.onKey({ key: 'enter' } as never)
    expect(cmds[0]!.action).toHaveBeenCalled()
  })

  it('onKey backspace removes last query char', () => {
    const cp = new CommandPalette(makeCommands())
    cp.openPalette()
    cp.onKey({ key: 'x' } as never)
    cp.onKey({ key: 'y' } as never)
    cp.onKey({ key: 'backspace' } as never)
    // after deleting 'y', query is 'x'; render should not throw
    const buf = new StubBuf()
    expect(() => cp.render(buf as never, 40, 80)).not.toThrow()
  })

  it('onKey escape returns close and sets isOpen false', () => {
    const cp = new CommandPalette(makeCommands())
    cp.openPalette()
    const result = cp.onKey({ key: 'escape' } as never)
    expect(result).toBe('close')
    expect(cp.isOpen).toBe(false)
  })

  it('onKey enter fires selected action and returns close', () => {
    const cmds = makeCommands(2)
    const cp = new CommandPalette(cmds)
    cp.openPalette()
    const result = cp.onKey({ key: 'enter' } as never)
    expect(result).toBe('close')
    expect(cmds[0]!.action).toHaveBeenCalled()
  })

  it('hint text is written into the buffer', () => {
    const cmds: PaletteCommand[] = [{ id: 'x', label: 'Do Thing', hint: 'F9', action: vi.fn() }]
    const cp = new CommandPalette(cmds)
    cp.openPalette()
    const buf = new StubBuf()
    cp.render(buf as never, 40, 80)
    const chars = Object.values(buf.cells).join('')
    expect(chars).toContain('F9')
  })
})

// ── CommandPalette.onMouse ───────────────────────────────────────────────────

describe('CommandPalette.onMouse', () => {
  const ROWS = 40
  const COLS = 80

  function paletteAt(): CommandPalette {
    const cp = new CommandPalette(makeCommands(3))
    cp.openPalette()
    return cp
  }

  it('click on first item executes its action and closes', () => {
    const cmds = makeCommands(3)
    const cp = new CommandPalette(cmds)
    cp.openPalette()
    // startRow = max(1, floor(40*0.25)-1) = max(1,9) = 9
    // item rows start at startRow + 3 = 12
    const result = cp.onMouse({ button: 'left', action: 'press', row: 12, col: 20, shift: false, ctrl: false, alt: false }, ROWS, COLS)
    expect(result).toBe('close')
    expect(cp.isOpen).toBe(false)
    expect(cmds[0]!.action).toHaveBeenCalled()
  })

  it('click on second item executes correct action', () => {
    const cmds = makeCommands(3)
    const cp = new CommandPalette(cmds)
    cp.openPalette()
    cp.onMouse({ button: 'left', action: 'press', row: 13, col: 20, shift: false, ctrl: false, alt: false }, ROWS, COLS)
    expect(cmds[1]!.action).toHaveBeenCalled()
  })

  it('click outside overlay closes without executing', () => {
    const cmds = makeCommands(3)
    const cp = new CommandPalette(cmds)
    cp.openPalette()
    // row 0 is above the overlay (startRow=9)
    const result = cp.onMouse({ button: 'left', action: 'press', row: 0, col: 20, shift: false, ctrl: false, alt: false }, ROWS, COLS)
    expect(result).toBe('close')
    expect(cp.isOpen).toBe(false)
    expect(cmds[0]!.action).not.toHaveBeenCalled()
  })

  it('non-left-click is consumed without executing', () => {
    const cp = paletteAt()
    const result = cp.onMouse({ button: 'right', action: 'press', row: 12, col: 20, shift: false, ctrl: false, alt: false }, ROWS, COLS)
    expect(result).toBe('consumed')
    expect(cp.isOpen).toBe(true)
  })

  it('release event is consumed without executing', () => {
    const cmds = makeCommands(3)
    const cp = new CommandPalette(cmds)
    cp.openPalette()
    const result = cp.onMouse({ button: 'left', action: 'release', row: 12, col: 20, shift: false, ctrl: false, alt: false }, ROWS, COLS)
    expect(result).toBe('consumed')
    expect(cmds[0]!.action).not.toHaveBeenCalled()
  })
})
