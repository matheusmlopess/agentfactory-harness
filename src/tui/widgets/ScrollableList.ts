import type { CellBuffer } from '../renderer/cell-buffer.js'
import { Colors } from '../renderer/theme.js'

export interface ListRow {
  /** Display text for this row. */
  text: string
  /** If true, this row is a non-selectable header/separator. */
  header?: boolean
  /** Optional right-aligned suffix (e.g. a ✓ marker). */
  suffix?: string
}

export interface ListOptions {
  visibleRows?: number
  /** Modulo navigation instead of clamping (default false — the convention). */
  wrap?: boolean
  /** Wheel moves the viewport (default, never the selection) or the selection. */
  wheel?: 'viewport' | 'selection'
  /** Rows per wheel tick: 1 for lists, 3 for text panes. */
  wheelStep?: 1 | 3
}

/**
 * The shared list behaviour (gaps 1, 2, 12): selection index + scroll window
 * with configurable wrap and wheel semantics. Renders into a CellBuffer
 * region, or can be used headless (state only) when the host paints rows
 * itself. Headers are skipped during navigation.
 */
export class ScrollableList {
  private rows: ListRow[] = []
  private selectedIdx = 0
  private scrollOffset = 0
  private visibleRows: number
  private readonly wrap: boolean
  private readonly wheelMode: 'viewport' | 'selection'
  private readonly wheelStep: number

  constructor(opts: number | ListOptions = 10) {
    const o: ListOptions = typeof opts === 'number' ? { visibleRows: opts } : opts
    this.visibleRows = Math.max(1, o.visibleRows ?? 10)
    this.wrap = o.wrap ?? false
    this.wheelMode = o.wheel ?? 'viewport'
    this.wheelStep = o.wheelStep ?? 1
  }

  setRows(rows: ListRow[], keepSelection = false): void {
    this.rows = rows
    if (!keepSelection) {
      this.selectedIdx = this.firstSelectable(0, 1)
      this.scrollOffset = 0
    } else {
      this.clampSelection()
      this.ensureVisible()
    }
  }

  setVisibleRows(n: number): void {
    this.visibleRows = Math.max(1, n)
    this.ensureVisible()
  }

  get selectedIndex(): number { return this.selectedIdx }
  get selectedRow(): ListRow | undefined { return this.rows[this.selectedIdx] }
  get rowCount(): number { return this.rows.length }
  get scrollTop(): number { return this.scrollOffset }
  /** Number of rows currently shown (≤ visibleRows). */
  get shownCount(): number { return Math.min(this.rows.length, this.visibleRows) }
  /** True when there are rows above or below the current window. */
  get isScrollable(): boolean { return this.rows.length > this.visibleRows }
  get hiddenBelow(): number { return Math.max(0, this.rows.length - this.scrollOffset - this.visibleRows) }
  get hiddenAbove(): number { return this.scrollOffset }

  // ── Navigation ─────────────────────────────────────────────────────────────

  moveUp(): void   { this.move(-1) }
  moveDown(): void { this.move(1) }
  scrollUp(): void   { this.scrollOffset = Math.max(0, this.scrollOffset - 1) }
  scrollDown(): void { this.scrollOffset = Math.min(this.maxScroll(), this.scrollOffset + 1) }

  /** Wheel input per the configured semantics (viewport ×step, or selection). */
  onWheel(dir: 'up' | 'down'): void {
    if (this.wheelMode === 'selection') {
      if (dir === 'up') this.moveUp()
      else this.moveDown()
      return
    }
    for (let i = 0; i < this.wheelStep; i++) {
      if (dir === 'up') this.scrollUp()
      else this.scrollDown()
    }
  }

  private move(dir: 1 | -1): void {
    if (this.wrap && this.rows.length > 0) {
      let i = this.selectedIdx
      for (let steps = 0; steps < this.rows.length; steps++) {
        i = (i + dir + this.rows.length) % this.rows.length
        if (!this.rows[i]?.header) { this.selectedIdx = i; break }
      }
    } else {
      this.selectedIdx = this.firstSelectable(this.selectedIdx + dir, dir)
    }
    this.ensureVisible()
  }

  /** Translate a click at viewport row `vRow` (0-based within the list) to an
   *  absolute index, selecting it. Returns the index, or -1 if out of range or
   *  a header. */
  selectAtViewportRow(vRow: number): number {
    const idx = this.scrollOffset + vRow
    const row = this.rows[idx]
    if (!row || row.header) return -1
    this.selectedIdx = idx
    return idx
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  /**
   * Render the visible window into the buffer starting at (row, col).
   * `width` is the inner content width (caller handles borders).
   */
  render(buf: CellBuffer, row: number, col: number, width: number): void {
    const shown = this.shownCount
    for (let i = 0; i < shown; i++) {
      const idx = this.scrollOffset + i
      const r = this.rows[idx]
      if (!r) break
      const y = row + i
      if (r.header) {
        buf.write(y, col, r.text.substring(0, width).padEnd(width), { fg: Colors.accent, bg: Colors.bgPanel, bold: true })
        continue
      }
      const selected = idx === this.selectedIdx
      const suffix = r.suffix ?? ''
      const prefix = selected ? '► ' : '  '
      const labelMax = width - suffix.length
      const label = (prefix + r.text).substring(0, labelMax).padEnd(labelMax)
      const fg = selected ? Colors.bg : Colors.text
      const bg = selected ? Colors.accent : Colors.bgPanel
      buf.write(y, col, label, { fg, bg, bold: selected })
      if (suffix) buf.write(y, col + labelMax, suffix, { fg, bg })
    }
  }

  /** Optional scroll indicator string for a footer row, or '' if not scrollable. */
  scrollHint(): string {
    if (!this.isScrollable) return ''
    const above = this.hiddenAbove > 0
    const below = this.hiddenBelow
    if (above && below > 0) return `  ▲ ${this.hiddenAbove} above  ▼ ${below} below`
    if (above)              return `  ▲ ${this.hiddenAbove} above`
    if (below > 0)          return `  ▼ ${below} below`
    return ''
  }

  // ── Internals ────────────────────────────────────────────────────────────────

  private maxScroll(): number { return Math.max(0, this.rows.length - this.visibleRows) }

  private clampSelection(): void {
    this.selectedIdx = Math.max(0, Math.min(this.rows.length - 1, this.selectedIdx))
  }

  private firstSelectable(start: number, dir: 1 | -1): number {
    let i = Math.max(0, Math.min(this.rows.length - 1, start))
    while (i >= 0 && i < this.rows.length && this.rows[i]?.header) i += dir
    if (i < 0 || i >= this.rows.length) return this.selectedIdx  // no move
    return i
  }

  private ensureVisible(): void {
    if (this.selectedIdx < this.scrollOffset) {
      this.scrollOffset = this.selectedIdx
    } else if (this.selectedIdx >= this.scrollOffset + this.visibleRows) {
      this.scrollOffset = this.selectedIdx - this.visibleRows + 1
    }
    this.scrollOffset = Math.max(0, Math.min(this.maxScroll(), this.scrollOffset))
  }
}
