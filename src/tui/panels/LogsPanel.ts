import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import type { MouseEvent } from '../input/mouse.js'
import type { KeyEvent } from '../input/keyboard.js'
import { Colors } from '../renderer/theme.js'
import { getRecentLogs, clearLogBuffer, getLogSources, type LogEntry } from '../../core/logger.js'

export class LogsPanel extends Panel {
  private selectedSource: string | null = null
  private scrollOffset = 0
  private selectedIdx = -1
  private insightsText = ''
  private insightsScroll = 0
  private insightsStreaming = false
  private lastLogCount = 0
  private analyzeButtonCol = -1
  private analyzeButtonLen = 0
  private onUpdate: () => void
  private onAnalyze?: (entries: LogEntry[]) => void

  constructor(rect: Rect, onUpdate: () => void, onAnalyze?: (entries: LogEntry[]) => void) {
    super(rect)
    this.onUpdate = onUpdate
    if (onAnalyze) this.onAnalyze = onAnalyze
  }

  startInsights(): void {
    this.insightsText = ''
    this.insightsStreaming = true
    this.insightsScroll = 0
    this.onUpdate()
  }

  appendInsights(delta: string): void {
    this.insightsText += delta
  }

  finishInsights(): void {
    this.insightsStreaming = false
    this.onUpdate()
  }

  override render(buf: CellBuffer): void {
    const r = this.inner
    buf.fill(r.row, r.col, r.height, r.width, ' ', { bg: Colors.bgPanel })

    // Split columns: 40% left, 60% right
    const splitCol = r.col + Math.floor(r.width * 0.4)
    const leftW = splitCol - r.col
    const rightW = r.width - leftW

    // Get entries
    const allSources = getLogSources()
    const entries = getRecentLogs(this.selectedSource ?? undefined)

    // Auto-scroll to bottom when new entries arrive
    if (entries.length > this.lastLogCount) {
      this.scrollOffset = 0
    }
    this.lastLogCount = entries.length

    // ── LEFT COLUMN ──────────────────────────────────────────────────────
    // Filter row
    let col = r.col + 1
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

    // Log entries
    const leftListRows = Math.max(1, r.height - 1)
    const start = Math.max(0, entries.length - leftListRows - this.scrollOffset)
    const visible = entries.slice(start, start + leftListRows)

    for (let i = 0; i < leftListRows; i++) {
      const row = r.row + 1 + i
      const entry = visible[i]
      const entryIdx = start + i
      const isSelected = entryIdx === this.selectedIdx

      const bg = isSelected ? Colors.bgActive : Colors.bgPanel
      buf.fill(row, r.col, 1, leftW, ' ', { bg })

      if (!entry) continue

      const time = entry.timestamp.slice(11, 19)
      const levelStr = entry.level.padEnd(5)
      const msgLen = leftW - 2 - 9 - 6  // account for padding and level
      const msg = (entry.message.substring(0, msgLen) + ' ').padEnd(msgLen)

      const fg = isSelected ? Colors.textBright : Colors.text
      buf.write(row, r.col + 1, time, { fg, bg })
      buf.write(row, r.col + 10, levelStr, { fg: this.levelColor(entry.level), bg, bold: true })
      buf.write(row, r.col + 16, msg, { fg: Colors.textDim, bg })
    }

    // ── DIVIDER ──────────────────────────────────────────────────────────
    for (let i = 1; i < r.height - 1; i++) {
      buf.write(r.row + i, splitCol, '│', { fg: Colors.border, bg: Colors.bgPanel })
    }

    // ── RIGHT COLUMN ─────────────────────────────────────────────────────
    if (this.selectedIdx >= 0 && this.selectedIdx < entries.length) {
      const entry = entries[this.selectedIdx]!

      // Header: "Selected Entry" + [Analyze] button
      const headerRow = r.row + 1
      const btnText = this.insightsStreaming ? '⟳ Analyzing…' : '⚡ Analyze'
      const btnLine = ` ─ Selected Entry ─────────────────── [${btnText}] ─`

      // Track button position
      const btnPos = btnLine.indexOf(`[${btnText}]`)
      this.analyzeButtonCol = r.col + leftW + 1 + btnPos
      this.analyzeButtonLen = btnText.length + 2

      buf.write(headerRow, r.col + leftW + 1, btnLine.substring(0, rightW - 1), {
        fg: Colors.textDim,
        bg: Colors.bgPanel,
      })

      // Details
      let detailRow = r.row + 2
      const detail = [
        `Time:    ${entry.timestamp.slice(11, 19)}`,
        `Level:   ${entry.level}`,
        `Source:  ${entry.source}`,
        `Message: ${entry.message}`,
      ]

      if (entry.meta) {
        detail.push('Meta:')
        for (const [k, v] of Object.entries(entry.meta)) {
          detail.push(`  ${k}: ${JSON.stringify(v)}`)
        }
      }

      for (const line of detail) {
        if (detailRow >= r.row + r.height - 2) break
        buf.write(
          detailRow,
          r.col + leftW + 2,
          line.substring(0, rightW - 3).padEnd(rightW - 3),
          { fg: Colors.text, bg: Colors.bgPanel },
        )
        detailRow++
      }

      // Insights section
      const insightsRow = Math.max(detailRow, r.row + 8)
      if (insightsRow < r.row + r.height - 1) {
        const insightHdr = ` ─ Insights ──────────────────────────────────────────`
        buf.write(insightsRow, r.col + leftW + 1, insightHdr.substring(0, rightW - 1), {
          fg: Colors.textDim,
          bg: Colors.bgPanel,
        })

        // Insights text (word-wrapped)
        const insightsContentRows = r.row + r.height - 1 - (insightsRow + 1)
        const insightLines = this.wrapText(this.insightsText, rightW - 3)
        const insightStart = Math.max(0, insightLines.length - insightsContentRows - this.insightsScroll)
        const insightVisible = insightLines.slice(insightStart, insightStart + insightsContentRows)

        for (let i = 0; i < insightsContentRows; i++) {
          const row = insightsRow + 1 + i
          const line = insightVisible[i] ?? ''
          buf.write(row, r.col + leftW + 2, line.padEnd(rightW - 3), {
            fg: Colors.text,
            bg: Colors.bgPanel,
          })
        }
      }
    } else {
      // No selection
      const msg = '(click a log entry to see details)'
      const centerRow = r.row + Math.floor(r.height / 2)
      const centerCol = r.col + leftW + Math.floor(rightW / 2) - Math.floor(msg.length / 2)
      buf.write(centerRow, centerCol, msg, { fg: Colors.textDim, bg: Colors.bgPanel })
    }
  }

  private levelColor(level: string): number {
    switch (level) {
      case 'DEBUG': return Colors.textDim
      case 'INFO': return Colors.text
      case 'WARN': return Colors.warning
      case 'ERROR': return Colors.error
      default: return Colors.text
    }
  }

  private wrapText(text: string, width: number): string[] {
    if (width <= 0) return [text]
    const lines: string[] = []
    let current = ''
    const words = text.split(' ')

    for (const word of words) {
      if ((current + word).length <= width) {
        current += (current ? ' ' : '') + word
      } else {
        if (current) lines.push(current)
        current = word
      }
    }
    if (current) lines.push(current)
    return lines.length > 0 ? lines : ['']
  }

  override onKey(e: KeyEvent): boolean {
    const entries = getRecentLogs(this.selectedSource ?? undefined)
    const allSources = getLogSources()

    if (e.key === 'arrow_up' || e.key === 'k') {
      const leftListRows = Math.max(1, this.inner.height - 1)
      if (this.selectedIdx >= 0) {
        this.selectedIdx = Math.max(-1, this.selectedIdx - 1)
      } else if (entries.length > 0) {
        this.selectedIdx = entries.length - 1
      }
      this.onUpdate()
      return true
    }

    if (e.key === 'arrow_down' || e.key === 'j') {
      if (this.selectedIdx < entries.length - 1) {
        this.selectedIdx++
      } else {
        this.selectedIdx = -1
      }
      this.onUpdate()
      return true
    }

    const sources = [null, ...allSources]
    const idx = sources.indexOf(this.selectedSource)

    if (e.key === 'arrow_left' || e.key === 'h') {
      this.selectedSource = sources[Math.max(0, idx - 1)] ?? null
      this.scrollOffset = 0
      this.selectedIdx = -1
      this.onUpdate()
      return true
    }

    if (e.key === 'arrow_right' || e.key === 'l') {
      this.selectedSource = sources[Math.min(sources.length - 1, idx + 1)] ?? null
      this.scrollOffset = 0
      this.selectedIdx = -1
      this.onUpdate()
      return true
    }

    if (e.key === 'c') {
      clearLogBuffer()
      this.selectedSource = null
      this.scrollOffset = 0
      this.selectedIdx = -1
      this.lastLogCount = 0
      this.insightsText = ''
      this.insightsScroll = 0
      this.onUpdate()
      return true
    }

    if (e.key === 'a' && !this.insightsStreaming) {
      this.onAnalyze?.(entries)
      return true
    }

    return false
  }

  override onMouse(e: MouseEvent): boolean {
    const r = this.inner
    const splitCol = r.col + Math.floor(r.width * 0.4)
    const leftW = splitCol - r.col

    // Filter row clickable region
    if (e.button === 'left' && e.action === 'press' && e.row === r.row) {
      const allSources = getLogSources()
      const sources = [null, ...allSources]

      let col = r.col + 1
      for (const source of sources) {
        const chip = `[${source === null ? 'All' : source}]`
        const chipLen = chip.length
        if (e.col >= col && e.col < col + chipLen) {
          this.selectedSource = source
          this.scrollOffset = 0
          this.selectedIdx = -1
          this.onUpdate()
          return true
        }
        col += chipLen + 1
      }
    }

    // Left column: scroll and log row selection
    if (e.col >= r.col && e.col < splitCol) {
      const entries = getRecentLogs(this.selectedSource ?? undefined)

      if (e.button === 'scroll_up') {
        this.scrollOffset = Math.min(this.scrollOffset + 1, Math.max(0, entries.length - 1))
        this.onUpdate()
        return true
      }

      if (e.button === 'scroll_down') {
        this.scrollOffset = Math.max(0, this.scrollOffset - 1)
        this.onUpdate()
        return true
      }

      if (e.button === 'left' && e.action === 'press' && e.row > r.row) {
        const rowIdx = e.row - (r.row + 1)
        const leftListRows = Math.max(1, r.height - 1)
        const start = Math.max(0, entries.length - leftListRows - this.scrollOffset)
        const clickedEntryIdx = start + rowIdx

        if (clickedEntryIdx >= 0 && clickedEntryIdx < entries.length) {
          this.selectedIdx = clickedEntryIdx
          this.onUpdate()
          return true
        }
      }
    }

    // Right column: Analyze button + insights scroll
    if (e.col > splitCol) {
      // Analyze button click
      if (
        e.button === 'left' &&
        e.action === 'press' &&
        this.analyzeButtonCol > 0 &&
        e.col >= this.analyzeButtonCol &&
        e.col < this.analyzeButtonCol + this.analyzeButtonLen &&
        !this.insightsStreaming
      ) {
        const entries = getRecentLogs(this.selectedSource ?? undefined)
        this.onAnalyze?.(entries)
        return true
      }

      // Insights scroll
      if (e.button === 'scroll_up') {
        const insightLines = this.wrapText(this.insightsText, this.inner.width - 8)
        this.insightsScroll = Math.min(this.insightsScroll + 1, Math.max(0, insightLines.length - 1))
        this.onUpdate()
        return true
      }

      if (e.button === 'scroll_down') {
        this.insightsScroll = Math.max(0, this.insightsScroll - 1)
        this.onUpdate()
        return true
      }
    }

    return false
  }
}
