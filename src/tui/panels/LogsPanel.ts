import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import type { MouseEvent } from '../input/mouse.js'
import type { KeyEvent } from '../input/keyboard.js'
import { Colors } from '../renderer/theme.js'
import { getRecentLogs, clearLogBuffer, getLogSources, type LogEntry } from '../../core/logger.js'

interface Metrics {
  total: number
  byLevel: Record<string, number>
  bySource: Array<[string, number]>
  errorCount: number
  recentErrors: LogEntry[]
}

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
  private heartbeatCountdown = 0
  private onUpdate: () => void
  private onAnalyze?: (entries: LogEntry[]) => void

  constructor(rect: Rect, onUpdate: () => void, onAnalyze?: (entries: LogEntry[]) => void) {
    super(rect)
    this.onUpdate = onUpdate
    if (onAnalyze) this.onAnalyze = onAnalyze
  }

  startInsights(auto: boolean): void {
    const when = new Date().toLocaleTimeString()
    const header = auto ? `[${when}] Auto-analysis:\n` : `[${when}] Manual analysis:\n`
    if (this.insightsText) this.insightsText += '\n'
    this.insightsText += header
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

  setCountdown(seconds: number): void {
    this.heartbeatCountdown = seconds
  }

  get isInsightsStreaming(): boolean {
    return this.insightsStreaming
  }

  private computeMetrics(entries: LogEntry[]): Metrics {
    const byLevel: Record<string, number> = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 }
    const bySourceMap = new Map<string, number>()

    for (const e of entries) {
      byLevel[e.level] = (byLevel[e.level] ?? 0) + 1
      bySourceMap.set(e.source, (bySourceMap.get(e.source) ?? 0) + 1)
    }

    const bySource = Array.from(bySourceMap.entries()).sort((a, b) => b[1] - a[1])
    const recentErrors = entries.filter(e => e.level === 'ERROR').slice(-5)

    return {
      total: entries.length,
      byLevel,
      bySource,
      errorCount: byLevel.ERROR ?? 0,
      recentErrors,
    }
  }

  override render(buf: CellBuffer): void {
    const r = this.inner
    buf.fill(r.row, r.col, r.height, r.width, ' ', { bg: Colors.bgPanel })

    const splitCol = r.col + Math.floor(r.width * 0.4)
    const leftW = splitCol - r.col
    const rightW = r.width - leftW

    // Get entries
    const allSources = getLogSources()
    const entries = getRecentLogs(this.selectedSource ?? undefined)

    // Auto-scroll to bottom
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
      const msgLen = leftW - 2 - 9 - 6
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
      this.renderEntryDetail(buf, r, leftW, rightW, entries[this.selectedIdx]!)
    } else {
      this.renderMetrics(buf, r, leftW, rightW, entries)
    }
  }

  private renderMetrics(buf: CellBuffer, r: Rect, leftW: number, rightW: number, entries: LogEntry[]): void {
    const metrics = this.computeMetrics(entries)
    const btnText = this.insightsStreaming ? '⟳ Analyzing…' : '⚡ Analyze'
    const headerLine = ` ─ Metrics ─────────────────────────── [${btnText}] ─`

    // Header
    const btnPos = headerLine.indexOf(`[${btnText}]`)
    this.analyzeButtonCol = r.col + leftW + 1 + btnPos
    this.analyzeButtonLen = btnText.length + 2

    buf.write(r.row + 1, r.col + leftW + 1, headerLine.substring(0, rightW - 1), {
      fg: Colors.textDim,
      bg: Colors.bgPanel,
    })

    // Metrics content
    let row = r.row + 2
    const rates = metrics.total > 0 ? (metrics.total / (Date.now() / 60000)).toFixed(1) : '0'

    buf.write(row, r.col + leftW + 2, `Total: ${metrics.total} entries   Rate: ${rates}/min`, {
      fg: Colors.text,
      bg: Colors.bgPanel,
    })
    row++

    // By Level bars
    buf.write(row, r.col + leftW + 2, 'By Level:', {
      fg: Colors.textDim,
      bg: Colors.bgPanel,
    })
    row++

    for (const level of ['INFO', 'WARN', 'ERROR', 'DEBUG'] as const) {
      if (metrics.total === 0) break
      const count = metrics.byLevel[level] ?? 0
      const pct = Math.round((count / metrics.total) * 100)
      const barLen = Math.max(1, Math.floor((count / metrics.total) * 12))
      const bar = '█'.repeat(barLen)
      const line = `  ${level.padEnd(5)} ${bar.padEnd(12)} ${count.toString().padStart(2)}`
      buf.write(row, r.col + leftW + 2, line.substring(0, rightW - 3), {
        fg: this.levelColor(level),
        bg: Colors.bgPanel,
      })
      row++
    }

    row++

    // By Source
    buf.write(row, r.col + leftW + 2, 'By Source:', {
      fg: Colors.textDim,
      bg: Colors.bgPanel,
    })
    row++

    for (const [source, count] of metrics.bySource.slice(0, 4)) {
      const barLen = Math.max(1, Math.floor((count / metrics.total) * 12))
      const bar = '█'.repeat(barLen)
      const line = `  ${source.padEnd(10)} ${count.toString().padStart(3)}  ${bar}`
      buf.write(row, r.col + leftW + 2, line.substring(0, rightW - 3), {
        fg: Colors.text,
        bg: Colors.bgPanel,
      })
      row++
    }

    // Insights header
    const insightsRow = Math.max(row + 1, r.row + r.height - 8)
    if (insightsRow < r.row + r.height - 1) {
      const insightHdr = ` ─ Insights ──────────────────────────────────────────`
      buf.write(insightsRow, r.col + leftW + 1, insightHdr.substring(0, rightW - 1), {
        fg: Colors.textDim,
        bg: Colors.bgPanel,
      })

      // Insights text
      const insightsContentRows = r.row + r.height - 1 - (insightsRow + 1)
      const insightLines = this.wrapText(this.insightsText, rightW - 3)
      const insightStart = Math.max(0, insightLines.length - insightsContentRows - this.insightsScroll)
      const insightVisible = insightLines.slice(insightStart, insightStart + insightsContentRows)

      for (let i = 0; i < insightsContentRows; i++) {
        const irow = insightsRow + 1 + i
        const line = insightVisible[i] ?? ''
        buf.write(irow, r.col + leftW + 2, line.padEnd(rightW - 3), {
          fg: Colors.text,
          bg: Colors.bgPanel,
        })
      }

      // Countdown
      if (this.heartbeatCountdown > 0) {
        const mins = Math.floor(this.heartbeatCountdown / 60)
        const secs = this.heartbeatCountdown % 60
        const countdownText = `⟳ Next analysis in ${mins}m ${secs}s`
        const countdownRow = r.row + r.height - 2
        buf.write(countdownRow, r.col + leftW + 2, countdownText, {
          fg: Colors.textDim,
          bg: Colors.bgPanel,
        })
      }
    }
  }

  private renderEntryDetail(buf: CellBuffer, r: Rect, leftW: number, rightW: number, entry: LogEntry): void {
    const btnText = this.insightsStreaming ? '⟳ Analyzing…' : '⚡ Analyze'
    const headerLine = ` ─ Entry ─────────────────────────── [${btnText}] ─`

    const btnPos = headerLine.indexOf(`[${btnText}]`)
    this.analyzeButtonCol = r.col + leftW + 1 + btnPos
    this.analyzeButtonLen = btnText.length + 2

    buf.write(r.row + 1, r.col + leftW + 1, headerLine.substring(0, rightW - 1), {
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
      buf.write(detailRow, r.col + leftW + 2, line.substring(0, rightW - 3).padEnd(rightW - 3), {
        fg: Colors.text,
        bg: Colors.bgPanel,
      })
      detailRow++
    }

    // Insights section
    const insightsRow = Math.max(detailRow + 1, r.row + 9)
    if (insightsRow < r.row + r.height - 1) {
      const insightHdr = ` ─ Insights ──────────────────────────────────────────`
      buf.write(insightsRow, r.col + leftW + 1, insightHdr.substring(0, rightW - 1), {
        fg: Colors.textDim,
        bg: Colors.bgPanel,
      })

      const insightsContentRows = r.row + r.height - 1 - (insightsRow + 1)
      const insightLines = this.wrapText(this.insightsText, rightW - 3)
      const insightStart = Math.max(0, insightLines.length - insightsContentRows - this.insightsScroll)
      const insightVisible = insightLines.slice(insightStart, insightStart + insightsContentRows)

      for (let i = 0; i < insightsContentRows; i++) {
        const irow = insightsRow + 1 + i
        const line = insightVisible[i] ?? ''
        buf.write(irow, r.col + leftW + 2, line.padEnd(rightW - 3), {
          fg: Colors.text,
          bg: Colors.bgPanel,
        })
      }
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

      // Text-pane wheel convention: ×3 rows per tick
      if (e.button === 'scroll_up') {
        this.scrollOffset = Math.min(this.scrollOffset + 3, Math.max(0, entries.length - 1))
        this.onUpdate()
        return true
      }

      if (e.button === 'scroll_down') {
        this.scrollOffset = Math.max(0, this.scrollOffset - 3)
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

      // Insights scroll — text-pane wheel convention: ×3 rows per tick
      if (e.button === 'scroll_up') {
        const insightLines = this.wrapText(this.insightsText, this.inner.width - 8)
        this.insightsScroll = Math.min(this.insightsScroll + 3, Math.max(0, insightLines.length - 1))
        this.onUpdate()
        return true
      }

      if (e.button === 'scroll_down') {
        this.insightsScroll = Math.max(0, this.insightsScroll - 3)
        this.onUpdate()
        return true
      }
    }

    return false
  }
}
