import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import type { MouseEvent } from '../input/mouse.js'
import type { KeyEvent } from '../input/keyboard.js'
import { Colors } from '../renderer/theme.js'
import { getRecentLogs, clearLogBuffer, getLogSources, type LogEntry } from '../../core/logger.js'

export class LogsPanel extends Panel {
  private selectedSource: string | null = null  // null = All
  private scrollOffset = 0
  private lastLogCount = 0
  private onUpdate: () => void

  constructor(rect: Rect, onUpdate: () => void) {
    super(rect)
    this.onUpdate = onUpdate
  }

  override render(buf: CellBuffer): void {
    const r = this.inner

    // Fill background
    buf.fill(r.row, r.col, r.height, r.width, ' ', { bg: Colors.bgPanel })

    // Get all sources and current entries
    const allSources = getLogSources()
    const entries = getRecentLogs(this.selectedSource ?? undefined)

    // Auto-scroll to bottom when new entries arrive
    if (entries.length > this.lastLogCount) {
      this.scrollOffset = 0
    }
    this.lastLogCount = entries.length

    // ── Filter row ──────────────────────────────────────────────────────
    let col = r.col
    const renderChip = (text: string, selected: boolean) => {
      const bg = selected ? Colors.accent : Colors.bgPanel
      const fg = selected ? Colors.bg : Colors.textDim
      const chip = `[${text}]`
      buf.write(r.row, col, chip, { fg, bg, bold: selected })
      col += chip.length + 1
    }

    renderChip('All', this.selectedSource === null)
    for (const source of allSources) {
      renderChip(source, this.selectedSource === source)
    }

    // ── Log entries ──────────────────────────────────────────────────────
    const contentRows = Math.max(1, r.height - 1)
    const start = Math.max(0, entries.length - contentRows - this.scrollOffset)
    const visible = entries.slice(start, start + contentRows)

    for (let i = 0; i < contentRows; i++) {
      const row = r.row + 1 + i
      const entry = visible[i]
      if (!entry) {
        buf.fill(row, r.col, 1, r.width, ' ', { bg: Colors.bgPanel })
        continue
      }

      const time = entry.timestamp.slice(11, 19)
      const levelColor = this.levelColor(entry.level)
      const sourceCol = r.col + 9
      const msgCol = r.col + 25

      buf.fill(row, r.col, 1, r.width, ' ', { bg: Colors.bgPanel })

      // Time
      buf.write(row, r.col, time, { fg: Colors.textDim, bg: Colors.bgPanel })

      // Level
      const levelStr = entry.level.padEnd(5)
      buf.write(row, r.col + 9, levelStr, { fg: levelColor, bg: Colors.bgPanel, bold: true })

      // Source (max 15 chars)
      const source = entry.source.substring(0, 15).padEnd(15)
      buf.write(row, sourceCol, source, { fg: Colors.textDim, bg: Colors.bgPanel })

      // Message (rest of row)
      const available = r.width - (msgCol - r.col)
      const msg = entry.message.substring(0, available).padEnd(available)
      buf.write(row, msgCol, msg, { fg: Colors.text, bg: Colors.bgPanel })
    }
  }

  private levelColor(level: string): number {
    switch (level) {
      case 'DEBUG': return Colors.textDim
      case 'INFO':  return Colors.text
      case 'WARN':  return Colors.warning
      case 'ERROR': return Colors.error
      default:      return Colors.text
    }
  }

  override onKey(e: KeyEvent): boolean {
    const entries = getRecentLogs(this.selectedSource ?? undefined)

    if (e.key === 'arrow_up' || e.key === 'k') {
      this.scrollOffset = Math.min(this.scrollOffset + 1, Math.max(0, entries.length - 1))
      this.onUpdate(); return true
    }
    if (e.key === 'arrow_down' || e.key === 'j') {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1)
      this.onUpdate(); return true
    }

    const allSources = getLogSources()
    const sources = [null, ...allSources]  // null = All
    const idx = sources.indexOf(this.selectedSource)

    if (e.key === 'arrow_left' || e.key === 'h') {
      this.selectedSource = sources[Math.max(0, idx - 1)] ?? null
      this.scrollOffset = 0
      this.onUpdate(); return true
    }
    if (e.key === 'arrow_right' || e.key === 'l') {
      this.selectedSource = sources[Math.min(sources.length - 1, idx + 1)] ?? null
      this.scrollOffset = 0
      this.onUpdate(); return true
    }

    if (e.key === 'c') {
      clearLogBuffer()
      this.selectedSource = null
      this.scrollOffset = 0
      this.lastLogCount = 0
      this.onUpdate(); return true
    }

    return false
  }

  override onMouse(e: MouseEvent): boolean {
    if (e.button === 'scroll_up') {
      const entries = getRecentLogs(this.selectedSource ?? undefined)
      this.scrollOffset = Math.min(this.scrollOffset + 1, Math.max(0, entries.length - 1))
      this.onUpdate(); return true
    }
    if (e.button === 'scroll_down') {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1)
      this.onUpdate(); return true
    }

    // Click on filter row to select source
    if (e.button === 'left' && e.action === 'press' && e.row === this.inner.row) {
      const allSources = getLogSources()
      const sources = [null, ...allSources]

      let col = this.inner.col
      for (const source of sources) {
        const chip = `[${source === null ? 'All' : source}]`
        const chipLen = chip.length
        if (e.col >= col && e.col < col + chipLen) {
          this.selectedSource = source
          this.scrollOffset = 0
          this.onUpdate()
          return true
        }
        col += chipLen + 1
      }
    }

    return false
  }
}
