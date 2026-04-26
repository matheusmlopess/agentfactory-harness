import * as A from './ansi.js'

export interface Cell {
  char: string
  fg: number   // 256-color index, -1 = default
  bg: number   // 256-color index, -1 = default
  bold: boolean
}

const BLANK: Cell = { char: ' ', fg: -1, bg: -1, bold: false }

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

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cur = this.cells[r]![c]!
        const old = prev.cells[r]?.[c]

        if (
          old &&
          old.char === cur.char &&
          old.fg === cur.fg &&
          old.bg === cur.bg &&
          old.bold === cur.bold
        ) continue

        // Move cursor only when not contiguous
        if (lastRow !== r || lastCol !== c) {
          out += A.moveTo(r + 1, c + 1)  // ANSI is 1-indexed
        }

        // Build SGR
        const codes: number[] = [0]
        if (cur.bold) codes.push(1)
        if (cur.fg >= 0) codes.push(38, 5, cur.fg)
        if (cur.bg >= 0) codes.push(48, 5, cur.bg)
        out += A.sgr(...codes)
        out += cur.char

        lastRow = r
        lastCol = c + 1
      }
    }

    if (out) out += A.sgr(0)  // reset after last write
    return out
  }

  /** Full flush — write every cell (used on initial render or resize). */
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
