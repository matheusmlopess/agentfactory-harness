import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'

export interface VTStyle {
  fg: number | undefined
  bg: number | undefined
  bold: boolean
  dim: boolean
  underline: boolean
  reverse: boolean
}

interface VTCell {
  char: string
  style: VTStyle
}

const DEFAULT_STYLE: VTStyle = {
  fg: undefined,
  bg: undefined,
  bold: false,
  dim: false,
  underline: false,
  reverse: false,
}

function blankCell(): VTCell {
  return { char: ' ', style: { ...DEFAULT_STYLE } }
}

type ParseState = 'normal' | 'escape' | 'csi' | 'osc'

/**
 * Virtual terminal screen: consumes raw PTY output bytes and maintains a
 * rows×cols cell grid. Driven by the ANSI action taxonomy described in
 * openclaude/src/ink/termio/parser.ts.
 */
export class VTScreen {
  private rows: number
  private cols: number
  private grid: VTCell[][]
  private curRow = 0
  private curCol = 0
  private style: VTStyle = { ...DEFAULT_STYLE }

  // Scroll region (VT-GAP-03): default = full screen
  private scrollTop = 0
  private scrollBottom: number

  // Alternate screen (VT-GAP-02)
  private altGrid: VTCell[][] | null = null
  private altCurRow = 0
  private altCurCol = 0
  private altStyle: VTStyle = { ...DEFAULT_STYLE }

  // Cursor visibility
  private cursorVisible = true

  // Parser state
  private state: ParseState = 'normal'
  private seqBuf = ''
  private privateMode = false

  constructor(rows: number, cols: number) {
    this.rows = rows
    this.cols = cols
    this.scrollBottom = rows - 1
    this.grid = this.makeGrid(rows, cols)
  }

  private makeGrid(rows: number, cols: number): VTCell[][] {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => blankCell()),
    )
  }

  get cursorRow(): number { return this.curRow }
  get cursorCol(): number { return this.curCol }

  resize(rows: number, cols: number): void {
    this.grid = this.resizeGrid(this.grid, rows, cols)
    if (this.altGrid) this.altGrid = this.resizeGrid(this.altGrid, rows, cols)
    this.rows = rows
    this.cols = cols
    this.curRow = Math.min(this.curRow, rows - 1)
    this.curCol = Math.min(this.curCol, cols - 1)
    // Reset scroll region to full screen on resize (same as xterm behaviour)
    this.scrollTop = 0
    this.scrollBottom = rows - 1
  }

  private resizeGrid(grid: VTCell[][], rows: number, cols: number): VTCell[][] {
    const newGrid = this.makeGrid(rows, cols)
    const copyRows = Math.min(rows, grid.length)
    const copyCols = Math.min(cols, grid[0]?.length ?? 0)
    for (let r = 0; r < copyRows; r++) {
      for (let c = 0; c < copyCols; c++) {
        newGrid[r]![c] = grid[r]![c]!
      }
    }
    return newGrid
  }

  feed(data: string): void {
    for (let i = 0; i < data.length; i++) {
      const ch = data[i]!
      this.consume(ch)
    }
  }

  private consume(ch: string): void {
    const code = ch.charCodeAt(0)

    if (this.state === 'normal') {
      if (code === 0x1b) {
        this.state = 'escape'
        this.seqBuf = ''
        return
      }
      this.handleChar(ch, code)
      return
    }

    if (this.state === 'escape') {
      if (ch === '[') {
        this.state = 'csi'
        this.seqBuf = ''
        this.privateMode = false
        return
      }
      if (ch === ']') {
        this.state = 'osc'
        this.seqBuf = ''
        return
      }
      // Other ESC sequences — ignore, reset
      this.state = 'normal'
      return
    }

    if (this.state === 'csi') {
      // Detect private-mode marker as first char of param string
      if (this.seqBuf === '' && '?>='.includes(ch)) {
        this.privateMode = ch === '?'
        this.seqBuf += ch
        return
      }
      // CSI ends on a byte in range 0x40–0x7e (@..~)
      if (code >= 0x40 && code <= 0x7e) {
        this.handleCSI(this.seqBuf, ch, this.privateMode)
        this.state = 'normal'
        this.seqBuf = ''
        this.privateMode = false
        return
      }
      this.seqBuf += ch
      return
    }

    if (this.state === 'osc') {
      // OSC ends on BEL (0x07) or ST (ESC \)
      if (code === 0x07 || (code === 0x1b && this.seqBuf.endsWith(''))) {
        this.state = 'normal'
        this.seqBuf = ''
        return
      }
      this.seqBuf += ch
      return
    }
  }

  private handleChar(ch: string, code: number): void {
    if (code === 0x0d) { // CR
      this.curCol = 0
      return
    }
    if (code === 0x0a) { // LF
      if (this.curRow === this.scrollBottom) {
        this.scrollUp()
      } else {
        this.curRow = Math.min(this.rows - 1, this.curRow + 1)
      }
      return
    }
    if (code === 0x08) { // BS
      if (this.curCol > 0) this.curCol--
      return
    }
    if (code === 0x07) return // BEL — ignore
    if (code < 0x20) return  // other control chars — ignore

    // Printable character
    if (this.curCol >= this.cols) {
      // Soft-wrap
      this.curCol = 0
      this.curRow++
      if (this.curRow >= this.rows) {
        this.scrollUp()
        this.curRow = this.rows - 1
      }
    }
    const cell = this.grid[this.curRow]?.[this.curCol]
    if (cell) {
      cell.char = ch
      cell.style = { ...this.style }
    }
    this.curCol++
  }

  private scrollUp(): void {
    // Scroll only within the defined scroll region (VT-GAP-03)
    this.grid.splice(this.scrollTop, 1)
    this.grid.splice(this.scrollBottom, 0, Array.from({ length: this.cols }, () => blankCell()))
  }

  private handleCSI(params: string, final: string, isPrivate: boolean): void {
    // Strip leading private-mode marker from param string for numeric parsing
    let p = params
    if (p.length > 0 && '?>='.includes(p[0]!)) p = p.slice(1)

    const nums = p === '' ? [] : p.split(/[;:]/).map((s) => (s === '' ? 0 : parseInt(s, 10)))
    const p0 = nums[0] ?? 0
    const p1 = nums[1] ?? 0

    // Private-mode set/reset: CSI ? Pn h/l
    if (isPrivate && (final === 'h' || final === 'l')) {
      const enable = final === 'h'
      switch (p0) {
        case 25:  // cursor visibility
          this.cursorVisible = enable
          break
        case 47:  // alternate screen (simple, no save/restore cursor)
        case 1049: // alternate screen with save/restore cursor
          if (enable) this.enterAltScreen(p0 === 1049)
          else        this.exitAltScreen(p0 === 1049)
          break
        // mouse tracking modes, bracketed paste, focus events — ignore
      }
      return
    }

    switch (final) {
      case 'm': this.applySGR(nums); break

      // Cursor positioning (1-based → 0-based)
      case 'H': case 'f':
        this.curRow = Math.max(0, Math.min(this.rows - 1, (p0 === 0 ? 1 : p0) - 1))
        this.curCol = Math.max(0, Math.min(this.cols - 1, (p1 === 0 ? 1 : p1) - 1))
        break

      case 'A': this.curRow = Math.max(0, this.curRow - Math.max(1, p0)); break // CUU
      case 'B': this.curRow = Math.min(this.rows - 1, this.curRow + Math.max(1, p0)); break // CUD
      case 'C': this.curCol = Math.min(this.cols - 1, this.curCol + Math.max(1, p0)); break // CUF
      case 'D': this.curCol = Math.max(0, this.curCol - Math.max(1, p0)); break // CUB
      case 'G': this.curCol = Math.max(0, Math.min(this.cols - 1, Math.max(1, p0) - 1)); break // CHA
      case 'd': this.curRow = Math.max(0, Math.min(this.rows - 1, Math.max(1, p0) - 1)); break // VPA

      // Scroll region (DECSTBM): CSI Pt;Pb r — VT-GAP-03
      case 'r':
        this.scrollTop    = Math.max(0, (p0 === 0 ? 1 : p0) - 1)
        this.scrollBottom = Math.min(this.rows - 1, (p1 === 0 ? this.rows : p1) - 1)
        if (this.scrollTop >= this.scrollBottom) {
          this.scrollTop = 0
          this.scrollBottom = this.rows - 1
        }
        // DECSTBM moves cursor to home position
        this.curRow = 0
        this.curCol = 0
        break

      // Erase display (ED)
      case 'J':
        if (p0 === 0) this.eraseToDisplayEnd()
        else if (p0 === 1) this.eraseToDisplayStart()
        else if (p0 === 2 || p0 === 3) this.eraseAll()
        break

      // Erase line (EL)
      case 'K':
        if (p0 === 0) this.eraseToLineEnd()
        else if (p0 === 1) this.eraseToLineStart()
        else if (p0 === 2) this.eraseLine(this.curRow)
        break

      // All other CSI sequences — ignore
    }
  }

  private enterAltScreen(saveCursor: boolean): void {
    if (this.altGrid) return // already in alt screen
    this.altGrid = this.grid
    if (saveCursor) {
      this.altCurRow = this.curRow
      this.altCurCol = this.curCol
      this.altStyle  = { ...this.style }
    }
    this.grid = this.makeGrid(this.rows, this.cols)
    this.curRow = 0
    this.curCol = 0
    this.style  = { ...DEFAULT_STYLE }
    this.scrollTop    = 0
    this.scrollBottom = this.rows - 1
  }

  private exitAltScreen(restoreCursor: boolean): void {
    if (!this.altGrid) return
    this.grid    = this.altGrid
    this.altGrid = null
    if (restoreCursor) {
      this.curRow = this.altCurRow
      this.curCol = this.altCurCol
      this.style  = { ...this.altStyle }
    }
    this.scrollTop    = 0
    this.scrollBottom = this.rows - 1
  }

  get isCursorVisible(): boolean { return this.cursorVisible }

  private applySGR(params: number[]): void {
    if (params.length === 0) {
      this.style = { ...DEFAULT_STYLE }
      return
    }

    let i = 0
    while (i < params.length) {
      const n = params[i]!
      switch (n) {
        case 0: this.style = { ...DEFAULT_STYLE }; break
        case 1: this.style.bold = true; break
        case 2: this.style.dim = true; break
        case 4: this.style.underline = true; break
        case 7: this.style.reverse = true; break
        case 22: this.style.bold = false; this.style.dim = false; break
        case 24: this.style.underline = false; break
        case 27: this.style.reverse = false; break
        case 39: this.style.fg = undefined; break
        case 49: this.style.bg = undefined; break

        // Standard 16-colour fg (30–37, 90–97)
        default:
          if (n >= 30 && n <= 37) { this.style.fg = n - 30; break }
          if (n >= 90 && n <= 97) { this.style.fg = n - 90 + 8; break }
          // Standard 16-colour bg (40–47, 100–107)
          if (n >= 40 && n <= 47) { this.style.bg = n - 40; break }
          if (n >= 100 && n <= 107) { this.style.bg = n - 100 + 8; break }
          // 256-colour / truecolour fg: 38;5;N or 38;2;R;G;B
          if (n === 38 && params[i + 1] === 5 && i + 2 < params.length) {
            this.style.fg = params[i + 2]!; i += 2; break
          }
          if (n === 38 && params[i + 1] === 2 && i + 4 < params.length) {
            // Map RGB to nearest 256-colour (approximate as xterm-256 index)
            this.style.fg = 16 + 36 * Math.round((params[i + 2]! / 255) * 5)
              + 6 * Math.round((params[i + 3]! / 255) * 5)
              + Math.round((params[i + 4]! / 255) * 5)
            i += 4; break
          }
          // 256-colour / truecolour bg: 48;5;N or 48;2;R;G;B
          if (n === 48 && params[i + 1] === 5 && i + 2 < params.length) {
            this.style.bg = params[i + 2]!; i += 2; break
          }
          if (n === 48 && params[i + 1] === 2 && i + 4 < params.length) {
            this.style.bg = 16 + 36 * Math.round((params[i + 2]! / 255) * 5)
              + 6 * Math.round((params[i + 3]! / 255) * 5)
              + Math.round((params[i + 4]! / 255) * 5)
            i += 4; break
          }
      }
      i++
    }
  }

  private eraseToDisplayEnd(): void {
    this.eraseToLineEnd()
    for (let r = this.curRow + 1; r < this.rows; r++) this.eraseLine(r)
  }

  private eraseToDisplayStart(): void {
    for (let r = 0; r < this.curRow; r++) this.eraseLine(r)
    this.eraseToLineStart()
  }

  private eraseAll(): void {
    for (let r = 0; r < this.rows; r++) this.eraseLine(r)
  }

  private eraseToLineEnd(): void {
    for (let c = this.curCol; c < this.cols; c++) {
      const cell = this.grid[this.curRow]?.[c]
      if (cell) { cell.char = ' '; cell.style = { ...DEFAULT_STYLE } }
    }
  }

  private eraseToLineStart(): void {
    for (let c = 0; c <= this.curCol; c++) {
      const cell = this.grid[this.curRow]?.[c]
      if (cell) { cell.char = ' '; cell.style = { ...DEFAULT_STYLE } }
    }
  }

  private eraseLine(row: number): void {
    const line = this.grid[row]
    if (!line) return
    for (let c = 0; c < this.cols; c++) {
      const cell = line[c]
      if (cell) { cell.char = ' '; cell.style = { ...DEFAULT_STYLE } }
    }
  }

  /** Blast the virtual screen into buf at the given inner rect. */
  render(buf: CellBuffer, inner: Rect): void {
    const maxRow = Math.min(this.rows, inner.height)
    const maxCol = Math.min(this.cols, inner.width)

    for (let r = 0; r < maxRow; r++) {
      for (let c = 0; c < maxCol; c++) {
        const cell = this.grid[r]?.[c]
        if (!cell) continue
        const style: Record<string, unknown> = {}
        if (cell.style.fg !== undefined) style['fg'] = cell.style.fg
        if (cell.style.bg !== undefined) style['bg'] = cell.style.bg
        if (cell.style.bold)      style['bold']      = true
        if (cell.style.dim)       style['dim']        = true
        if (cell.style.underline) style['underline']  = true
        if (cell.style.reverse)   style['reverse']    = true
        buf.write(inner.row + r, inner.col + c, cell.char, style)
      }
    }
  }
}
