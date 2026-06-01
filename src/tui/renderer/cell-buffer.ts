import * as A from './ansi.js'

/** Color value: 256-palette index (≥0), -1 = terminal default, or [r,g,b] truecolour. */
export type Color = number | readonly [number, number, number]

export interface Cell {
  char: string
  fg: Color   // -1 = default
  bg: Color   // -1 = default
  bold: boolean
  dim: boolean
  underline: boolean
  reverse: boolean
  link?: string  // OSC 8 hyperlink URL (undefined = no link)
}

const BLANK: Cell = {
  char: ' ', fg: -1, bg: -1,
  bold: false, dim: false, underline: false, reverse: false,
}

function colorEq(a: Color, b: Color): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
}

function fgCodes(color: Color): number[] {
  if (typeof color === 'number') return color >= 0 ? [38, 5, color] : []
  return [38, 2, color[0]!, color[1]!, color[2]!]
}

function bgCodes(color: Color): number[] {
  if (typeof color === 'number') return color >= 0 ? [48, 5, color] : []
  return [48, 2, color[0]!, color[1]!, color[2]!]
}

export class CellBuffer {
  readonly rows: number
  readonly cols: number
  private cells: Cell[][]

  constructor(rows: number, cols: number) {
    this.rows = rows
    this.cols = cols
    this.cells = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ ...BLANK }))
    )
  }

  /** Write a string at (row, col) with optional style. Clips to bounds. */
  write(
    row: number,
    col: number,
    text: string,
    style: Partial<Omit<Cell, 'char'>> = {}
  ): void {
    for (let i = 0; i < text.length; i++) {
      const c = col + i
      if (row < 0 || row >= this.rows || c < 0 || c >= this.cols) continue
      const char = text[i] ?? ' '
      this.cells[row]![c] = {
        char,
        fg: style.fg ?? -1,
        bg: style.bg ?? -1,
        bold: style.bold ?? false,
        dim: style.dim ?? false,
        underline: style.underline ?? false,
        reverse: style.reverse ?? false,
        ...(style.link !== undefined ? { link: style.link } : {}),
      }
    }
  }

  /** Fill a rectangular region with a character and style. */
  fill(
    row: number,
    col: number,
    height: number,
    width: number,
    char: string,
    style: Partial<Omit<Cell, 'char'>> = {}
  ): void {
    for (let r = row; r < row + height; r++) {
      this.write(r, col, char.repeat(width), style)
    }
  }

  /** Compute diff against a previous buffer. Returns flush string. */
  diff(prev: CellBuffer): string {
    let out = ''
    let lastRow = -1
    let lastCol = -1
    let currentLink = ''  // tracks the OSC 8 link state emitted to the terminal

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cur = this.cells[r]![c]!
        const old = prev.cells[r]?.[c]

        if (
          old &&
          old.char === cur.char &&
          colorEq(old.fg, cur.fg) &&
          colorEq(old.bg, cur.bg) &&
          old.bold === cur.bold &&
          old.dim === cur.dim &&
          old.underline === cur.underline &&
          old.reverse === cur.reverse &&
          old.link === cur.link
        ) continue

        if (lastRow !== r || lastCol !== c) {
          out += A.moveTo(r + 1, c + 1)
        }

        const codes: number[] = [0]
        if (cur.bold)      codes.push(1)
        if (cur.dim)       codes.push(2)
        if (cur.underline) codes.push(4)
        if (cur.reverse)   codes.push(7)
        codes.push(...fgCodes(cur.fg))
        codes.push(...bgCodes(cur.bg))
        out += A.sgr(...codes)

        // OSC 8 hyperlink — emit open/close only on transitions
        const linkUrl = cur.link ?? ''
        if (linkUrl !== currentLink) {
          out += linkUrl ? A.osc8Open(linkUrl) : A.osc8Close()
          currentLink = linkUrl
        }

        out += cur.char

        lastRow = r
        lastCol = c + 1
      }
    }

    if (currentLink) out += A.osc8Close()  // close any open link before SGR reset
    if (out) out += A.sgr(0)
    return out
  }

  flush(): string {
    const empty = new CellBuffer(this.rows, this.cols)
    return this.diff(empty)
  }

  clone(): CellBuffer {
    const b = new CellBuffer(this.rows, this.cols)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        b.cells[r]![c] = { ...this.cells[r]![c]! }
      }
    }
    return b
  }
}
