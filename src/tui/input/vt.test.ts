import { describe, it, expect, beforeEach } from 'vitest'
import { VTScreen } from './vt.js'

// Minimal CellBuffer stub — records write calls
class StubBuf {
  cells: Record<string, { char: string; style: unknown }> = {}
  write(row: number, col: number, text: string, style: unknown): void {
    for (let i = 0; i < text.length; i++) {
      this.cells[`${row},${col + i}`] = { char: text[i]!, style }
    }
  }
  fill(): void {}
  diff(): string { return '' }
  clone(): this { return this }
  getChar(row: number, col: number): string {
    return this.cells[`${row},${col}`]?.char ?? ' '
  }
}

function esc(s: string): string { return `\x1b${s}` }
function csi(s: string): string { return `\x1b[${s}` }

describe('VTScreen', () => {
  let screen: VTScreen
  let buf: StubBuf

  beforeEach(() => {
    screen = new VTScreen(5, 10)
    buf = new StubBuf()
  })

  it('writes printable text and advances cursor', () => {
    screen.feed('Hello')
    expect(screen.cursorCol).toBe(5)
    expect(screen.cursorRow).toBe(0)
    screen.render(buf as never, { row: 0, col: 0, height: 5, width: 10 })
    expect(buf.getChar(0, 0)).toBe('H')
    expect(buf.getChar(0, 4)).toBe('o')
  })

  it('CR resets cursor column to 0', () => {
    screen.feed('Hi\r')
    expect(screen.cursorCol).toBe(0)
    expect(screen.cursorRow).toBe(0)
  })

  it('LF advances row', () => {
    screen.feed('Hi\nBye')
    expect(screen.cursorRow).toBe(1)
  })

  it('LF at bottom scrolls grid', () => {
    // PTY outputs CRLF; CR resets col, LF advances row
    screen.feed('A\r\nB\r\nC\r\nD\r\nE') // fill 5 rows at col 0
    expect(screen.cursorRow).toBe(4)
    screen.feed('\r\n') // triggers scroll
    expect(screen.cursorRow).toBe(4)
    screen.render(buf as never, { row: 0, col: 0, height: 5, width: 10 })
    // Row 0 ('A') scrolled off; 'E' is now at grid row 3
    expect(buf.getChar(3, 0)).toBe('E')
  })

  it('BS decrements cursor column', () => {
    screen.feed('AB\x08')
    expect(screen.cursorCol).toBe(1)
  })

  it('CUP positions cursor (1-based)', () => {
    screen.feed(csi('3;5H'))
    expect(screen.cursorRow).toBe(2)
    expect(screen.cursorCol).toBe(4)
  })

  it('CUP with zeros treated as 1,1', () => {
    screen.feed(csi('0;0H'))
    expect(screen.cursorRow).toBe(0)
    expect(screen.cursorCol).toBe(0)
  })

  it('CUU moves cursor up', () => {
    screen.feed(csi('3;1H')) // row 3
    screen.feed(csi('2A'))   // up 2
    expect(screen.cursorRow).toBe(0)
  })

  it('CUD moves cursor down', () => {
    screen.feed(csi('1B'))
    expect(screen.cursorRow).toBe(1)
  })

  it('CUF moves cursor forward', () => {
    screen.feed(csi('3C'))
    expect(screen.cursorCol).toBe(3)
  })

  it('CUB moves cursor back', () => {
    screen.feed('Hello')     // curCol=5
    screen.feed(csi('2D'))   // back 2
    expect(screen.cursorCol).toBe(3)
  })

  it('CHA sets cursor column (1-based)', () => {
    screen.feed(csi('5G'))
    expect(screen.cursorCol).toBe(4)
  })

  it('ED 0 erases from cursor to end of display', () => {
    screen.feed('Hello')
    screen.feed(csi('1;3H')) // position (row=0, col=2)
    screen.feed(csi('0J'))
    screen.render(buf as never, { row: 0, col: 0, height: 5, width: 10 })
    expect(buf.getChar(0, 0)).toBe('H')
    expect(buf.getChar(0, 1)).toBe('e')
    expect(buf.getChar(0, 2)).toBe(' ') // erased
  })

  it('ED 2 erases entire display', () => {
    screen.feed('Hello')
    screen.feed(csi('2J'))
    screen.render(buf as never, { row: 0, col: 0, height: 5, width: 10 })
    for (let c = 0; c < 5; c++) expect(buf.getChar(0, c)).toBe(' ')
  })

  it('EL 0 erases to end of line', () => {
    screen.feed('Hello')
    screen.feed(csi('1;3H')) // col=2
    screen.feed(csi('0K'))
    screen.render(buf as never, { row: 0, col: 0, height: 5, width: 10 })
    expect(buf.getChar(0, 0)).toBe('H')
    expect(buf.getChar(0, 1)).toBe('e')
    expect(buf.getChar(0, 2)).toBe(' ')
  })

  it('SGR 0 resets style', () => {
    screen.feed(csi('1m')) // bold on
    screen.feed(csi('0m')) // reset
    screen.feed('X')
    screen.render(buf as never, { row: 0, col: 0, height: 5, width: 10 })
    const cell = buf.cells['0,0']
    expect((cell?.style as Record<string, unknown>)?.['bold']).toBeFalsy()
  })

  it('SGR bold and dim', () => {
    screen.feed(csi('1;2mA'))
    screen.render(buf as never, { row: 0, col: 0, height: 5, width: 10 })
    const style = buf.cells['0,0']?.style as Record<string, unknown>
    expect(style?.['bold']).toBe(true)
    expect(style?.['dim']).toBe(true)
  })

  it('SGR 38;5;N sets fg to N', () => {
    screen.feed(csi('38;5;196mR'))
    screen.render(buf as never, { row: 0, col: 0, height: 5, width: 10 })
    const style = buf.cells['0,0']?.style as Record<string, unknown>
    expect(style?.['fg']).toBe(196)
  })

  it('SGR 48;5;N sets bg to N', () => {
    screen.feed(csi('48;5;21mB'))
    screen.render(buf as never, { row: 0, col: 0, height: 5, width: 10 })
    const style = buf.cells['0,0']?.style as Record<string, unknown>
    expect(style?.['bg']).toBe(21)
  })

  it('SGR 39 resets fg', () => {
    screen.feed(csi('31m')) // red fg
    screen.feed(csi('39m')) // reset fg
    screen.feed('X')
    screen.render(buf as never, { row: 0, col: 0, height: 5, width: 10 })
    const style = buf.cells['0,0']?.style as Record<string, unknown>
    expect(style?.['fg']).toBeUndefined()
  })

  it('resize expands grid and preserves existing cells', () => {
    screen.feed('AB')
    screen.resize(8, 20)
    expect(screen.cursorRow).toBe(0)
    expect(screen.cursorCol).toBe(2)
    screen.render(buf as never, { row: 0, col: 0, height: 8, width: 20 })
    expect(buf.getChar(0, 0)).toBe('A')
    expect(buf.getChar(0, 1)).toBe('B')
  })

  it('resize clamps cursor if now out of bounds', () => {
    screen.feed(csi('5;10H')) // bottom-right
    screen.resize(3, 5)
    expect(screen.cursorRow).toBeLessThan(3)
    expect(screen.cursorCol).toBeLessThan(5)
  })

  it('soft-wrap at column boundary', () => {
    screen.feed('ABCDEFGHIJ') // 10 chars — exactly fills row 0
    screen.feed('K')          // wraps to row 1, col 0
    expect(screen.cursorRow).toBe(1)
    expect(screen.cursorCol).toBe(1)
  })

  it('ignores OSC sequences', () => {
    screen.feed('\x1b]0;window title\x07Hi')
    screen.render(buf as never, { row: 0, col: 0, height: 5, width: 10 })
    expect(buf.getChar(0, 0)).toBe('H')
    expect(buf.getChar(0, 1)).toBe('i')
  })
})
