import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { KeyEvent } from '../input/keyboard.js'
import type { MouseEvent } from '../input/mouse.js'
import type { Rect } from '../renderer/layout.js'
import { Colors } from '../renderer/theme.js'
import { Session } from '../../core/session.js'
import { agentLoop } from '../../core/agent-loop.js'
import { runHook } from '../../core/hooks.js'
import { createAdapter, defaultProvider, listModels } from '../../core/llm/index.js'
import type { Provider, ModelEntry } from '../../core/llm/index.js'

// Fallback list used when API keys aren't configured or fetch fails
const FALLBACK_MODELS: readonly ModelEntry[] = [
  { provider: 'anthropic', id: 'claude-opus-4-8',           label: 'Claude Opus 4.8'    },
  { provider: 'anthropic', id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6'  },
  { provider: 'anthropic', id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5'   },
  { provider: 'openai',    id: 'gpt-4o',                    label: 'gpt-4o'             },
  { provider: 'openai',    id: 'gpt-4o-mini',               label: 'gpt-4o-mini'        },
  { provider: 'openai',    id: 'o3',                        label: 'o3'                 },
  { provider: 'openai',    id: 'o4-mini',                   label: 'o4-mini'            },
] as const

interface ChatLine {
  role: 'user' | 'assistant' | 'system'
  text: string
}

export class SessionPanel extends Panel {
  private session: Session
  private lines: ChatLine[] = []
  private inputBuf = ''
  private scrollOffset = 0
  private streaming = false
  private onUpdate: () => void
  private scrollbarDragging = false
  private scrollbarDragStartY = 0
  private scrollbarDragStartOffset = 0
  private selectedModel: ModelEntry | null = null
  private modelPickerOpen = false
  private modelPickerIdx = 0
  private pickerModels: ModelEntry[] = []
  private pickerLoading = false

  constructor(rect: Rect, onUpdate: () => void) {
    super(rect)
    this.session = new Session()
    this.onUpdate = onUpdate
    this.lines.push({ role: 'system', text: 'factory v0.4.0 — type a message or /help' })
  }

  getSession(): Session { return this.session }

  getSelectedModel(): ModelEntry | null { return this.selectedModel }

  /** Open the model picker, fetching models from configured providers. */
  openModelPicker(): void {
    this.modelPickerOpen = true
    this.pickerLoading   = true
    this.pickerModels    = []
    this.modelPickerIdx  = 0
    this.onUpdate()
    void this.fetchPickerModels()
  }

  render(buf: CellBuffer): void {
    const r = this.inner
    const displayRows = r.height - 1   // last row is input bar
    const inputRow = r.row + r.height - 1
    const maxScroll = this.maxScroll()
    const hasScrollbar = maxScroll > 0
    // Reserve right column for scrollbar when content overflows
    const contentWidth = hasScrollbar ? r.width - 1 : r.width
    const scrollbarCol = r.col + r.width - 1

    // Render scrollback
    const wrappedLines = this.wrapLines(contentWidth)
    const start = Math.max(0, wrappedLines.length - displayRows - this.scrollOffset)
    const visible = wrappedLines.slice(start, start + displayRows)

    for (let i = 0; i < displayRows; i++) {
      const line = visible[i]
      buf.fill(r.row + i, r.col, 1, contentWidth, ' ', { bg: Colors.bgPanel })
      if (line) {
        const fg = line.role === 'user'
          ? Colors.accent
          : line.role === 'system'
          ? Colors.textDim
          : Colors.text
        buf.write(r.row + i, r.col, line.text.substring(0, contentWidth), { fg, bg: Colors.bgPanel })
      }
    }

    // Scrollbar
    if (hasScrollbar) {
      const thumbRow = Math.floor(
        (1 - this.scrollOffset / maxScroll) * (displayRows - 1)
      )
      for (let i = 0; i < displayRows; i++) {
        const ch = i === thumbRow ? '█' : '│'
        buf.write(r.row + i, scrollbarCol, ch, { fg: Colors.textDim, bg: Colors.bgPanel })
      }
    }

    // Input bar — show selected model tag when one is chosen
    buf.fill(inputRow, r.col, 1, r.width, ' ', { bg: Colors.bg })
    const prompt = this.streaming ? '… ' : '> '
    const cursor = this.focused && !this.streaming ? '█' : ''
    // Show selected model or the effective default (so user knows what will be used)
    const effectiveModel = this.selectedModel?.id ?? `${defaultProvider()} default`
    const modelTag = ` [${effectiveModel}]`
    const available = r.width - modelTag.length - 1
    const inputDisplay = (prompt + this.inputBuf + cursor).substring(0, available)
    buf.write(inputRow, r.col, inputDisplay, { fg: Colors.text, bg: Colors.bg })
    if (modelTag) {
      buf.write(inputRow, r.col + r.width - modelTag.length, modelTag, { fg: Colors.textDim, bg: Colors.bg })
    }

    // Model picker overlay
    if (this.modelPickerOpen) this.renderModelPicker(buf, r)
  }

  private handlePickerClick(row: number, col: number): boolean {
    if (this.pickerLoading) return true  // consume clicks while loading

    const r = this.inner
    const modalW = Math.min(r.width - 4, 56)
    const models = this.pickerModels

    // Rebuild display rows (same logic as render)
    type DRow = { kind: 'header' } | { kind: 'model'; idx: number }
    const displayRows: DRow[] = []
    let lastProv = ''
    for (let i = 0; i < models.length; i++) {
      const m = models[i]!
      if (m.provider !== lastProv) { displayRows.push({ kind: 'header' }); lastProv = m.provider }
      displayRows.push({ kind: 'model', idx: i })
    }

    const modalH   = Math.min(displayRows.length + 3, r.height - 4)
    const modalRow = r.row + Math.max(0, Math.floor((r.height - modalH) / 2))
    const modalCol = r.col + Math.floor((r.width - modalW) / 2)

    // Click outside overlay → close
    if (row < modalRow || row >= modalRow + modalH || col < modalCol || col >= modalCol + modalW) {
      this.modelPickerOpen = false
      this.onUpdate()
      return true
    }

    // Click on a model row (content rows start at modalRow + 1)
    const itemRow = row - (modalRow + 1)
    if (itemRow >= 0 && itemRow < displayRows.length) {
      const dr = displayRows[itemRow]
      if (dr?.kind === 'model') {
        const picked = models[dr.idx]
        if (picked) {
          this.selectedModel     = picked
          this.modelPickerIdx    = dr.idx
          this.lines.push({ role: 'system', text: `Model set to ${picked.label}` })
          this.modelPickerOpen   = false
          this.onUpdate()
        }
      }
    }
    return true
  }

  private renderModelPicker(buf: CellBuffer, r: { row: number; col: number; height: number; width: number }): void {
    const modalW = Math.min(r.width - 4, 56)
    const inner  = modalW - 2

    if (this.pickerLoading) {
      const modalH   = 4
      const modalRow = r.row + Math.max(0, Math.floor((r.height - modalH) / 2))
      const modalCol = r.col + Math.floor((r.width - modalW) / 2)
      buf.fill(modalRow, modalCol, modalH, modalW, ' ', { bg: Colors.bgPanel })
      const hLine = '─'.repeat(inner)
      buf.write(modalRow,             modalCol, '┌' + hLine + '┐', { fg: Colors.borderActive, bg: Colors.bgPanel })
      buf.write(modalRow + modalH - 1, modalCol, '└' + hLine + '┘', { fg: Colors.borderActive, bg: Colors.bgPanel })
      for (let i = 1; i < modalH - 1; i++) {
        buf.write(modalRow + i, modalCol, '│', { fg: Colors.borderActive, bg: Colors.bgPanel })
        buf.write(modalRow + i, modalCol + modalW - 1, '│', { fg: Colors.borderActive, bg: Colors.bgPanel })
      }
      buf.write(modalRow, modalCol + 2, ' Select Model ', { fg: Colors.textBright, bg: Colors.bgPanel, bold: true })
      buf.write(modalRow + 2, modalCol + 2, '⣾ Fetching models from providers…', { fg: Colors.textDim, bg: Colors.bgPanel })
      return
    }

    const models = this.pickerModels

    // Build display rows with provider headers
    type Row = { kind: 'header'; label: string } | { kind: 'model'; entry: ModelEntry; idx: number }
    const displayRows: Row[] = []
    let lastProv = ''
    for (let i = 0; i < models.length; i++) {
      const m = models[i]!
      if (m.provider !== lastProv) {
        displayRows.push({ kind: 'header', label: m.provider === 'anthropic' ? '── Anthropic ──' : '── OpenAI ──' })
        lastProv = m.provider
      }
      displayRows.push({ kind: 'model', entry: m, idx: i })
    }

    const modalH   = Math.min(displayRows.length + 3, r.height - 4)
    const modalRow = r.row + Math.max(0, Math.floor((r.height - modalH) / 2))
    const modalCol = r.col + Math.floor((r.width - modalW) / 2)

    buf.fill(modalRow, modalCol, modalH, modalW, ' ', { bg: Colors.bgPanel })
    const hLine = '─'.repeat(inner)
    buf.write(modalRow,             modalCol, '┌' + hLine + '┐', { fg: Colors.borderActive, bg: Colors.bgPanel })
    buf.write(modalRow + modalH - 1, modalCol, '└' + hLine + '┘', { fg: Colors.borderActive, bg: Colors.bgPanel })
    for (let i = 1; i < modalH - 1; i++) {
      buf.write(modalRow + i, modalCol, '│', { fg: Colors.borderActive, bg: Colors.bgPanel })
      buf.write(modalRow + i, modalCol + modalW - 1, '│', { fg: Colors.borderActive, bg: Colors.bgPanel })
    }
    buf.write(modalRow, modalCol + 2, ' Select Model ', { fg: Colors.textBright, bg: Colors.bgPanel, bold: true })

    const visible = modalH - 2  // rows available for content
    for (let i = 0; i < Math.min(displayRows.length, visible); i++) {
      const dr = displayRows[i]!
      const absRow = modalRow + 1 + i
      if (dr.kind === 'header') {
        buf.write(absRow, modalCol + 1, ` ${dr.label}`.padEnd(inner), { fg: Colors.accent, bg: Colors.bgPanel, bold: true })
      } else {
        const selected  = dr.idx === this.modelPickerIdx
        const isCurrent = this.selectedModel?.id === dr.entry.id
        const prefix  = selected ? '► ' : '  '
        const suffix  = isCurrent ? ' ✓' : ''
        const label   = (prefix + dr.entry.label + suffix).substring(0, inner).padEnd(inner)
        buf.write(absRow, modalCol + 1, label, {
          fg:   selected ? Colors.bg    : Colors.text,
          bg:   selected ? Colors.accent : Colors.bgPanel,
          bold: selected,
        })
      }
    }
  }

  onKey(e: KeyEvent): boolean {
    // Model picker intercepts all keys when open
    if (this.modelPickerOpen) {
      if (e.key === 'escape') {
        this.modelPickerOpen = false
        this.onUpdate(); return true
      }
      if (!this.pickerLoading) {
        if (e.key === 'arrow_up') {
          this.modelPickerIdx = Math.max(0, this.modelPickerIdx - 1)
          this.onUpdate(); return true
        }
        if (e.key === 'arrow_down') {
          this.modelPickerIdx = Math.min(this.pickerModels.length - 1, this.modelPickerIdx + 1)
          this.onUpdate(); return true
        }
        if (e.key === 'enter') {
          const picked = this.pickerModels[this.modelPickerIdx]
          if (picked) {
            this.selectedModel = picked
            this.lines.push({ role: 'system', text: `Model set to ${picked.label}` })
          }
          this.modelPickerOpen = false
          this.onUpdate(); return true
        }
      }
      return true
    }

    if (e.key === 'enter') {
      this.submit()
      return true
    }
    if (e.key === 'backspace') {
      this.inputBuf = this.inputBuf.slice(0, -1)
      this.onUpdate()
      return true
    }
    if (e.key === 'arrow_up') {
      this.scrollOffset = Math.min(this.scrollOffset + 1, this.maxScroll())
      this.onUpdate()
      return true
    }
    if (e.key === 'arrow_down') {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1)
      this.onUpdate()
      return true
    }
    if (e.key.length === 1 && e.key >= ' ') {
      this.inputBuf += e.key
      this.onUpdate()
      return true
    }
    return false
  }

  override onMouse(e: MouseEvent): boolean {
    // Model picker intercepts all mouse when open
    if (this.modelPickerOpen && e.button === 'left' && e.action === 'press') {
      return this.handlePickerClick(e.row, e.col)
    }

    if (e.button === 'scroll_up') {
      this.scrollOffset = Math.min(this.scrollOffset + 3, this.maxScroll())
      this.onUpdate(); return true
    }
    if (e.button === 'scroll_down') {
      this.scrollOffset = Math.max(0, this.scrollOffset - 3)
      this.onUpdate(); return true
    }

    const r = this.inner
    const maxScroll  = this.maxScroll()
    const displayRows = r.height - 1
    const scrollbarCol = r.col + r.width - 1

    // Release — always ends drag
    if (e.button === 'left' && e.action === 'release') {
      if (this.scrollbarDragging) { this.scrollbarDragging = false; return true }
      return false
    }

    // Drag move — update offset proportionally to how far the thumb moved
    if (e.button === 'left' && e.action === 'move' && this.scrollbarDragging) {
      if (maxScroll > 0 && displayRows > 1) {
        const delta = e.row - this.scrollbarDragStartY
        const scrollDelta = -Math.round(delta * maxScroll / (displayRows - 1))
        this.scrollOffset = Math.max(0, Math.min(maxScroll, this.scrollbarDragStartOffset + scrollDelta))
        this.onUpdate()
      }
      return true
    }

    // Press on scrollbar column → jump to position + start drag
    if (e.button === 'left' && e.action === 'press' &&
        maxScroll > 0 && e.col === scrollbarCol &&
        e.row >= r.row && e.row < r.row + displayRows) {
      const i = e.row - r.row
      this.scrollOffset = Math.max(0, Math.min(maxScroll,
        Math.round((1 - i / (displayRows - 1)) * maxScroll)
      ))
      this.scrollbarDragging      = true
      this.scrollbarDragStartY    = e.row
      this.scrollbarDragStartOffset = this.scrollOffset
      this.onUpdate()
      return true
    }

    return false
  }

  private maxScroll(): number {
    const r = this.inner
    const displayRows = r.height - 1
    return Math.max(0, this.wrapLines(r.width).length - displayRows)
  }

  private submit(): void {
    const text = this.inputBuf.trim()
    this.inputBuf = ''
    if (!text || this.streaming) return

    if (text.startsWith('/')) {
      this.handleSlashCommand(text)
      return
    }

    this.lines.push({ role: 'user', text })
    this.session.addMessage({ role: 'user', content: text })
    this.scrollOffset = 0
    this.onUpdate()
    void this.runAgentLoop()
  }

  clearSession(): void {
    this.session.clear()
    this.lines = [{ role: 'system', text: 'Session cleared.' }]
    this.scrollOffset = 0
    this.onUpdate()
  }

  private handleSlashCommand(cmd: string): void {
    const parts = cmd.slice(1).split(' ')
    const name = parts[0] ?? ''
    switch (name) {
      case 'help':
        this.lines.push({ role: 'system', text: 'Commands: /help /clear /tokens /model' })
        break
      case 'clear':
        this.session.clear()
        this.lines = [{ role: 'system', text: 'Session cleared.' }]
        break
      case 'tokens':
        this.lines.push({ role: 'system', text: `Approx tokens: ${this.session.tokenCount()}` })
        break
      case 'model': {
        const arg = parts.slice(1).join(' ').trim()
        if (arg) {
          const pool = this.pickerModels.length > 0 ? this.pickerModels : [...FALLBACK_MODELS]
          const found = pool.find(m => m.id === arg || m.label.toLowerCase() === arg.toLowerCase())
          if (found) {
            this.selectedModel = found
            this.lines.push({ role: 'system', text: `Model set to ${found.label}` })
          } else {
            this.lines.push({ role: 'system', text: `Unknown model: "${arg}". Type /model to browse.` })
          }
        } else {
          this.openModelPicker()
        }
        break
      }
      default:
        this.lines.push({ role: 'system', text: `Unknown command: /${name}` })
    }
    this.onUpdate()
  }

  private async fetchPickerModels(): Promise<void> {
    const results: ModelEntry[] = []
    for (const p of ['anthropic', 'openai'] as Provider[]) {
      try {
        const models = await listModels(p)
        results.push(...models)
      } catch { /* no key or network error — skip provider */ }
    }
    // Fall back to hardcoded list if nothing was fetched
    this.pickerModels = results.length > 0 ? results : [...FALLBACK_MODELS]
    // Restore selection index to current model
    if (this.selectedModel) {
      const idx = this.pickerModels.findIndex(m => m.id === this.selectedModel!.id)
      this.modelPickerIdx = idx >= 0 ? idx : 0
    }
    this.pickerLoading = false
    this.onUpdate()
  }

  private async runAgentLoop(): Promise<void> {
    this.streaming = true
    await runHook('SessionStart', {})

    const provider = this.selectedModel?.provider ?? defaultProvider()
    const adapter  = createAdapter(provider)
    const loopOpts = this.selectedModel
      ? { adapter, model: this.selectedModel.id, maxTurns: 20 }
      : { adapter, maxTurns: 20 }

    let currentLine: ChatLine | undefined
    try {
      for await (const event of agentLoop(this.session, loopOpts)) {
        if (event.type === 'text_delta') {
          if (!currentLine) {
            currentLine = { role: 'assistant', text: '' }
            this.lines.push(currentLine)
          }
          currentLine.text += event.delta
          this.scrollOffset = 0
          this.onUpdate()
        } else if (event.type === 'tool_start') {
          currentLine = undefined
          this.lines.push({ role: 'system', text: `  tool: ${event.name}` })
          this.onUpdate()
        } else if (event.type === 'tool_result') {
          const preview = event.content.substring(0, 80).replace(/\n/g, ' ')
          this.lines.push({ role: 'system', text: `  → ${preview}` })
          currentLine = undefined
          this.onUpdate()
        } else if (event.type === 'turn_end') {
          currentLine = undefined
        } else if (event.type === 'error') {
          this.lines.push({ role: 'system', text: `Error: ${event.error.message}` })
          this.onUpdate()
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.lines.push({ role: 'system', text: `Error: ${msg}` })
      this.onUpdate()
    } finally {
      this.streaming = false
      await runHook('SessionStop', {})
      this.onUpdate()
    }
  }

  private wrapLines(width: number): ChatLine[] {
    const result: ChatLine[] = []
    for (const line of this.lines) {
      if (line.text.length <= width) {
        result.push(line)
      } else {
        let remaining = line.text
        while (remaining.length > 0) {
          result.push({ role: line.role, text: remaining.substring(0, width) })
          remaining = remaining.substring(width)
        }
      }
    }
    return result
  }
}
