import type { CellBuffer } from '../../shared/renderer/cell-buffer.js'
import type { Color } from '../../shared/renderer/cell-buffer.js'
import type { Rect } from '../../shared/renderer/layout.js'

export interface VTStyle {
  fg: Color | undefined
  bg: Color | undefined
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

const SCROLLBACK_MAX = 1000
const PAGE_LINES = 10  // rows scrolled per Shift+PgUp/Dn

/**
 * Returns the display-column width of a Unicode code point.
 * Wide chars (CJK, emoji, fullwidth) return 2; all others return 1.
 */
function charWidth(code: number): 1 | 2 {
  if (code <= 0x7e) return 1
  // Combining / zero-width
  if (code <= 0x036f && code >= 0x0300) return 1  // combining diacritics
  // Hangul Jamo
  if (code >= 0x1100 && code <= 0x115f) return 2
  // CJK Radicals / Kangxi / Enclosed CJK
  if (code >= 0x2e80 && code <= 0x303f) return 2
  // Hiragana, Katakana, Bopomofo, Hangul compat, CJK unified extensions
  if (code >= 0x3040 && code <= 0x33ff) return 2
  // CJK Extension A
  if (code >= 0x3400 && code <= 0x4dbf) return 2
  // CJK Unified Ideographs
  if (code >= 0x4e00 && code <= 0x9fff) return 2
  // Yi, CJK compatibility
  if (code >= 0xa000 && code <= 0xa4cf) return 2
  // Hangul Syllables
  if (code >= 0xac00 && code <= 0xd7af) return 2
  // CJK Compatibility Ideographs
  if (code >= 0xf900 && code <= 0xfaff) return 2
  // CJK Compatibility Forms
  if (code >= 0xfe30 && code <= 0xfe4f) return 2
  // Fullwidth ASCII / halfwidth Katakana
  if (code >= 0xff01 && code <= 0xff60) return 2
  if (code >= 0xffe0 && code <= 0xffe6) return 2
  // Emoji and symbols (supplementary)
  if (code >= 0x1f300 && code <= 0x1faff) return 2
  return 1
}

/**
 * Virtual terminal screen: consumes raw PTY output bytes and maintains a
 * rows×cols cell grid. Supports alternate screen, DECSTBM scroll regions,
 * wide characters, and a scrollback ring buffer.
 */
export class VTScreen {
  private rows: number
  private cols: number
  private grid: VTCell[][]
  private curRow = 0
  private curCol = 0
  private style: VTStyle = { ...DEFAULT_STYLE }

  // Scroll region (VT-GAP-03 — resolved)
  private scrollTop = 0
  private scrollBottom: number

  // Alternate screen (VT-GAP-02 — resolved)
  private altGrid: VTCell[][] | null = null
  private altCurRow = 0
  private altCurCol = 0
  private altStyle: VTStyle = { ...DEFAULT_STYLE }

  // Cursor visibility
  private cursorVisible = true

  // Scrollback buffer (VT-GAP-06 — resolved)
  private scrollback: VTCell[][] = []
  private scrollOffset = 0  // 0 = live view; >0 = scrolled back N rows

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
  get isCursorVisible(): boolean { return this.cursorVisible }
  get isScrolledBack(): boolean { return this.scrollOffset > 0 }

  /** Scroll back N rows (Shift+PgUp). */
  scrollBack(lines = PAGE_LINES): void {
    this.scrollOffset = Math.min(this.scrollOffset + lines, this.scrollback.length)
  }

  /** Scroll forward N rows (Shift+PgDn). */
  scrollForward(lines = PAGE_LINES): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - lines)
  }

  resize(rows: number, cols: number): void {
    this.grid = this.resizeGrid(this.grid, rows, cols)
    if (this.altGrid) this.altGrid = this.resizeGrid(this.altGrid, rows, cols)
    this.rows = rows
    this.cols = cols
    this.curRow = Math.min(this.curRow, rows - 1)
    this.curCol = Math.min(this.curCol, cols - 1)
    this.scrollTop = 0
    this.scrollBottom = rows - 1
    this.scrollOffset = 0  // snap back to live on resize
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
      this.consume(data[i]!)
    }
  }

  private consume(ch: string): void {
    const code = ch.charCodeAt(0)

    if (this.state === 'normal') {
      if (code === 0x1b) { this.state = 'escape'; this.seqBuf = ''; return }
      this.handleChar(ch, code)
      return
    }

    if (this.state === 'escape') {
      if (ch === '[') { this.state = 'csi'; this.seqBuf = ''; this.privateMode = false; return }
      if (ch === ']') { this.state = 'osc'; this.seqBuf = ''; return }
      this.state = 'normal'
      return
    }

    if (this.state === 'csi') {
      if (this.seqBuf === '' && '?>='.includes(ch)) {
        this.privateMode = ch === '?'
        this.seqBuf += ch
        return
      }
      if (code >= 0x40 && code <= 0x7e) {
        this.handleCSI(this.seqBuf, ch, this.privateMode)
        this.state = 'normal'; this.seqBuf = ''; this.privateMode = false
        return
      }
      this.seqBuf += ch
      return
    }

    if (this.state === 'osc') {
      if (code === 0x07 || (code === 0x1b && this.seqBuf.endsWith(''))) {
        this.state = 'normal'; this.seqBuf = ''
        return
      }
      this.seqBuf += ch
      return
    }
  }

  private handleChar(ch: string, code: number): void {
    if (code === 0x0d) { this.curCol = 0; return }
    if (code === 0x0a) {
      if (this.curRow === this.scrollBottom) {
        this.scrollUp()
      } else {
        this.curRow = Math.min(this.rows - 1, this.curRow + 1)
      }
      return
    }
    if (code === 0x08) { if (this.curCol > 0) this.curCol--; return }
    if (code === 0x07) return
    if (code < 0x20) return

    // VT-GAP-01: wide character support
    const codePoint = ch.codePointAt(0) ?? code
    const wide = charWidth(codePoint) === 2

    if (this.curCol >= this.cols) {
      this.curCol = 0
      this.curRow++
      if (this.curRow >= this.rows) { this.scrollUp(); this.curRow = this.rows - 1 }
    }

    const cell = this.grid[this.curRow]?.[this.curCol]
    if (cell) { cell.char = ch; cell.style = { ...this.style } }
    this.curCol++

    if (wide && this.curCol < this.cols) {
      // Blank placeholder occupies the second column of the wide char
      const ph = this.grid[this.curRow]?.[this.curCol]
      if (ph) { ph.char = ' '; ph.style = { ...DEFAULT_STYLE } }
      this.curCol++
    }
  }

  private scrollUp(): void {
    const removed = this.grid.splice(this.scrollTop, 1)
    // Save to scrollback only when the top-of-screen row is removed
    if (removed[0] && this.scrollTop === 0 && this.altGrid === null) {
      this.scrollback.push(removed[0])
      if (this.scrollback.length > SCROLLBACK_MAX) this.scrollback.shift()
    }
    this.grid.splice(this.scrollBottom, 0,
      Array.from({ length: this.cols }, () => blankCell()))
  }

  private handleCSI(params: string, final: string, isPrivate: boolean): void {
    let p = params
    if (p.length > 0 && '?>='.includes(p[0]!)) p = p.slice(1)

    const nums = p === '' ? [] : p.split(/[;:]/).map(s => s === '' ? 0 : parseInt(s, 10))
    const p0 = nums[0] ?? 0
    const p1 = nums[1] ?? 0

    if (isPrivate && (final === 'h' || final === 'l')) {
      const enable = final === 'h'
      switch (p0) {
        case 25: this.cursorVisible = enable; break
        case 47:
        case 1049:
          if (enable) this.enterAltScreen(p0 === 1049)
          else        this.exitAltScreen(p0 === 1049)
          break
      }
      return
    }

    switch (final) {
      case 'm': this.applySGR(nums); break

      case 'H': case 'f':
        this.curRow = Math.max(0, Math.min(this.rows - 1, (p0 === 0 ? 1 : p0) - 1))
        this.curCol = Math.max(0, Math.min(this.cols - 1, (p1 === 0 ? 1 : p1) - 1))
        break

      case 'A': this.curRow = Math.max(0, this.curRow - Math.max(1, p0)); break
      case 'B': this.curRow = Math.min(this.rows - 1, this.curRow + Math.max(1, p0)); break
      case 'C': this.curCol = Math.min(this.cols - 1, this.curCol + Math.max(1, p0)); break
      case 'D': this.curCol = Math.max(0, this.curCol - Math.max(1, p0)); break
      case 'G': this.curCol = Math.max(0, Math.min(this.cols - 1, Math.max(1, p0) - 1)); break
      case 'd': this.curRow = Math.max(0, Math.min(this.rows - 1, Math.max(1, p0) - 1)); break

      case 'r':
        this.scrollTop    = Math.max(0, (p0 === 0 ? 1 : p0) - 1)
        this.scrollBottom = Math.min(this.rows - 1, (p1 === 0 ? this.rows : p1) - 1)
        if (this.scrollTop >= this.scrollBottom) {
          this.scrollTop = 0; this.scrollBottom = this.rows - 1
        }
        this.curRow = 0; this.curCol = 0
        break

      case 'J':
        if (p0 === 0) this.eraseToDisplayEnd()
        else if (p0 === 1) this.eraseToDisplayStart()
        else if (p0 === 2 || p0 === 3) this.eraseAll()
        break

      case 'K':
        if (p0 === 0) this.eraseToLineEnd()
        else if (p0 === 1) this.eraseToLineStart()
        else if (p0 === 2) this.eraseLine(this.curRow)
        break
    }
  }

  private enterAltScreen(saveCursor: boolean): void {
    if (this.altGrid) return
    this.altGrid = this.grid
    if (saveCursor) {
      this.altCurRow = this.curRow; this.altCurCol = this.curCol
      this.altStyle  = { ...this.style }
    }
    this.grid = this.makeGrid(this.rows, this.cols)
    this.curRow = 0; this.curCol = 0
    this.style  = { ...DEFAULT_STYLE }
    this.scrollTop = 0; this.scrollBottom = this.rows - 1
    this.scrollOffset = 0
  }

  private exitAltScreen(restoreCursor: boolean): void {
    if (!this.altGrid) return
    this.grid    = this.altGrid
    this.altGrid = null
    if (restoreCursor) {
      this.curRow = this.altCurRow; this.curCol = this.altCurCol
      this.style  = { ...this.altStyle }
    }
    this.scrollTop = 0; this.scrollBottom = this.rows - 1
  }

  private applySGR(params: number[]): void {
    if (params.length === 0) { this.style = { ...DEFAULT_STYLE }; return }

    let i = 0
    while (i < params.length) {
      const n = params[i]!
      switch (n) {
        case 0:  this.style = { ...DEFAULT_STYLE }; break
        case 1:  this.style.bold = true; break
        case 2:  this.style.dim = true; break
        case 4:  this.style.underline = true; break
        case 7:  this.style.reverse = true; break
        case 22: this.style.bold = false; this.style.dim = false; break
        case 24: this.style.underline = false; break
        case 27: this.style.reverse = false; break
        case 39: this.style.fg = undefined; break
        case 49: this.style.bg = undefined; break

        default:
          if (n >= 30 && n <= 37) { this.style.fg = n - 30; break }
          if (n >= 90 && n <= 97) { this.style.fg = n - 90 + 8; break }
          if (n >= 40 && n <= 47) { this.style.bg = n - 40; break }
          if (n >= 100 && n <= 107) { this.style.bg = n - 100 + 8; break }

          // 256-colour fg
          if (n === 38 && params[i + 1] === 5 && i + 2 < params.length) {
            this.style.fg = params[i + 2]!; i += 2; break
          }
          // Truecolour fg (VT-GAP-07 — resolved: store [r,g,b] natively)
          if (n === 38 && params[i + 1] === 2 && i + 4 < params.length) {
            this.style.fg = [params[i + 2]!, params[i + 3]!, params[i + 4]!] as const
            i += 4; break
          }
          // 256-colour bg
          if (n === 48 && params[i + 1] === 5 && i + 2 < params.length) {
            this.style.bg = params[i + 2]!; i += 2; break
          }
          // Truecolour bg
          if (n === 48 && params[i + 1] === 2 && i + 4 < params.length) {
            this.style.bg = [params[i + 2]!, params[i + 3]!, params[i + 4]!] as const
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

  /** Blast the virtual screen into buf at the given inner rect.
   *  When scrolled back, shows scrollback rows followed by live grid rows. */
  render(buf: CellBuffer, inner: Rect): void {
    const maxRow = Math.min(this.rows, inner.height)
    const maxCol = Math.min(this.cols, inner.width)
    const sbLen = this.scrollback.length

    for (let r = 0; r < maxRow; r++) {
      // Resolve which row to render: scrollback or live grid
      let row: VTCell[] | undefined
      if (this.scrollOffset > 0) {
        const sbIdx = sbLen - this.scrollOffset + r
        if (sbIdx >= 0 && sbIdx < sbLen) {
          row = this.scrollback[sbIdx]
        } else if (sbIdx >= sbLen) {
          row = this.grid[sbIdx - sbLen]
        }
        // sbIdx < 0 means we're before the oldest scrollback row — leave row undefined (blank)
      } else {
        row = this.grid[r]
      }

      for (let c = 0; c < maxCol; c++) {
        const cell = row?.[c]
        if (!cell) continue
        const style: Record<string, unknown> = {}
        if (cell.style.fg !== undefined) style['fg'] = cell.style.fg
        if (cell.style.bg !== undefined) style['bg'] = cell.style.bg
        if (cell.style.bold)      style['bold']      = true
        if (cell.style.dim)       style['dim']       = true
        if (cell.style.underline) style['underline'] = true
        if (cell.style.reverse)   style['reverse']   = true
        buf.write(inner.row + r, inner.col + c, cell.char, style)
      }
    }
  }
}
