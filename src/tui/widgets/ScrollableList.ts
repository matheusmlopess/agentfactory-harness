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

/**
 * A reusable keyboard + mouse scrollable selection list.
 *
 * Owns selection index and a scroll window. Renders into a CellBuffer region
 * with a fixed number of visible rows; auto-scrolls to keep the selection in
 * view. Headers are skipped during navigation.
 *
 * Used by the model picker and any future list overlay (agents, command
 * palette results, etc.) so scroll behaviour is identical everywhere.
 */
export class ScrollableList {
  private rows: ListRow[] = []
  private selectedIdx = 0
  private scrollOffset = 0
  private visibleRows: number

  constructor(visibleRows = 10) {
    this.visibleRows = Math.max(1, visibleRows)
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

  moveUp(): void   { this.selectedIdx = this.firstSelectable(this.selectedIdx - 1, -1); this.ensureVisible() }
  moveDown(): void { this.selectedIdx = this.firstSelectable(this.selectedIdx + 1,  1); this.ensureVisible() }
  scrollUp(): void   { this.scrollOffset = Math.max(0, this.scrollOffset - 1) }
  scrollDown(): void { this.scrollOffset = Math.min(this.maxScroll(), this.scrollOffset + 1) }

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
