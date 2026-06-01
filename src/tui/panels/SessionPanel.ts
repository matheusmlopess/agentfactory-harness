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
import { store } from '../../core/config/store.js'

const MAX_PICKER_VISIBLE = 10

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

export interface SessionStats {
  status:       'running' | 'done' | 'error'
  model:        string
  inputTokens:  number
  outputTokens: number
  toolCalls:    number
  turns:        number
  startTime:    number
}

interface SlashCommand {
  name: string
  desc: string
}

const SLASH_COMMANDS: readonly SlashCommand[] = [
  { name: '/help',   desc: 'Show available commands'            },
  { name: '/model',  desc: 'Select model (provider → model)'    },
  { name: '/config', desc: 'Open Config tab (API keys, login)'  },
  { name: '/clear',  desc: 'Clear the conversation'             },
  { name: '/tokens', desc: 'Show approximate token count'       },
] as const

export class SessionPanel extends Panel {
  private session: Session
  private lines: ChatLine[] = []
  private inputBuf = ''
  private scrollOffset = 0
  private streaming = false
  private onUpdate: () => void
  private onStats?: (s: SessionStats) => void
  private onNavigate?: (target: 'config') => void
  private acIndex = 0   // autocomplete selection index
  private scrollbarDragging = false
  private scrollbarDragStartY = 0
  private scrollbarDragStartOffset = 0
  private hScroll = 0   // horizontal scroll offset for wide content (tables)
  private selectedModel: ModelEntry | null = null
  private modelPickerOpen = false
  // step 1 — provider selection
  private pickerStep: 'provider' | 'model' = 'provider'
  private pickerProviders: { provider: Provider; name: string }[] = []
  private pickerProviderIdx = 0
  // step 2 — model selection
  private modelPickerIdx = 0
  private pickerModels: ModelEntry[] = []
  private pickerLoading = false
  private pickerScrollOffset = 0

  constructor(rect: Rect, onUpdate: () => void, onStats?: (s: SessionStats) => void, onNavigate?: (target: 'config') => void) {
    super(rect)
    this.session = new Session()
    this.onUpdate = onUpdate
    if (onStats) this.onStats = onStats
    if (onNavigate) this.onNavigate = onNavigate
    this.lines.push({ role: 'system', text: 'factory v0.4.0 — type a message or /help' })
  }

  getSession(): Session { return this.session }

  getSelectedModel(): ModelEntry | null { return this.selectedModel }

  /** Open the model picker — shows provider selection first. */
  openModelPicker(): void {
    const ALL_PROVIDERS: { provider: Provider; name: string }[] = [
      { provider: 'anthropic', name: 'Anthropic Claude' },
      { provider: 'openai',    name: 'OpenAI'           },
    ]
    // Only show providers that have a key configured
    this.pickerProviders = ALL_PROVIDERS.filter(p =>
      !!(store.getKey(p.provider, p.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'))
    )
    // If no keys at all, show all providers so user can still pick and see the fetch error
    if (this.pickerProviders.length === 0) this.pickerProviders = ALL_PROVIDERS

    this.pickerStep        = 'provider'
    this.pickerProviderIdx = 0
    this.modelPickerOpen   = true
    this.pickerModels      = []
    this.pickerLoading     = false
    this.pickerScrollOffset = 0

    // If only one provider configured, skip straight to model list
    if (this.pickerProviders.length === 1) this.selectProvider(0)
    else this.onUpdate()
  }

  private selectProvider(idx: number): void {
    const prov = this.pickerProviders[idx]
    if (!prov) return
    this.pickerStep         = 'model'
    this.pickerLoading      = true
    this.pickerModels       = []
    this.pickerScrollOffset = 0
    this.modelPickerIdx     = 0
    this.onUpdate()
    void this.fetchPickerModels(prov.provider)
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

    // Build display lines: word-wrap prose, keep table/code lines intact (h-scroll)
    const lines = this.buildDisplayLines(contentWidth)
    const start = Math.max(0, lines.length - displayRows - this.scrollOffset)
    const visible = lines.slice(start, start + displayRows)

    // Clamp horizontal scroll to the widest visible line
    const widest = visible.reduce((m, l) => Math.max(m, l.text.length), 0)
    const maxH = Math.max(0, widest - contentWidth)
    if (this.hScroll > maxH) this.hScroll = maxH

    let anyClipped = false
    for (let i = 0; i < displayRows; i++) {
      const line = visible[i]
      buf.fill(r.row + i, r.col, 1, contentWidth, ' ', { bg: Colors.bgPanel })
      if (line) {
        const fg = line.role === 'user'
          ? Colors.accent
          : line.role === 'system'
          ? Colors.textDim
          : Colors.text
        const clipped = line.text.substring(this.hScroll, this.hScroll + contentWidth)
        if (line.text.length > this.hScroll + contentWidth) anyClipped = true
        buf.write(r.row + i, r.col, clipped, { fg, bg: Colors.bgPanel })
      }
    }

    // Horizontal scroll hint — shown on the last content row when text is clipped
    if (anyClipped || this.hScroll > 0) {
      const hint = `[← →  h:${this.hScroll}]`
      buf.write(r.row + displayRows - 1, r.col + contentWidth - hint.length, hint, { fg: Colors.warning, bg: Colors.bgPanel })
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

    // Slash command autocomplete (above the input bar)
    this.renderAutocomplete(buf, r, inputRow)

    // Model picker overlay
    if (this.modelPickerOpen) this.renderModelPicker(buf, r)
  }

  /** Commands matching the current input, or [] if autocomplete isn't active. */
  private acMatches(): SlashCommand[] {
    const buf = this.inputBuf
    if (!buf.startsWith('/') || buf.includes(' ')) return []
    const q = buf.toLowerCase()
    return SLASH_COMMANDS.filter(c => c.name.startsWith(q))
  }

  private renderAutocomplete(buf: CellBuffer, r: { row: number; col: number; height: number; width: number }, inputRow: number): void {
    const matches = this.acMatches()
    if (matches.length === 0) return
    if (this.acIndex >= matches.length) this.acIndex = 0

    const popupH = Math.min(matches.length, 6)
    const nameW  = Math.max(...matches.map(m => m.name.length)) + 2
    const popupW = Math.min(r.width, nameW + 32)
    const startRow = inputRow - popupH  // sits directly above input bar

    for (let i = 0; i < popupH; i++) {
      const m = matches[i]!
      const selected = i === this.acIndex
      const fg = selected ? Colors.bg : Colors.accent
      const bg = selected ? Colors.accent : Colors.bgActive
      const namePart = m.name.padEnd(nameW)
      const line = (namePart + m.desc).substring(0, popupW).padEnd(popupW)
      buf.write(startRow + i, r.col, line, { fg: selected ? Colors.bg : Colors.text, bg })
      buf.write(startRow + i, r.col, namePart.substring(0, popupW), { fg, bg, bold: true })
    }
  }

  // ── Picker geometry helper ────────────────────────────────────────────────

  private pickerGeometry(r: { row: number; col: number; height: number; width: number }, contentRows: number) {
    const modalW   = Math.min(r.width - 4, 56)
    const modalH   = Math.min(contentRows + 2, r.height - 4)  // border top/bot
    const modalRow = r.row + Math.max(0, Math.floor((r.height - modalH) / 2))
    const modalCol = r.col + Math.floor((r.width - modalW) / 2)
    return { modalW, modalH, modalRow, modalCol, inner: modalW - 2 }
  }

  private drawPickerFrame(buf: CellBuffer, title: string, g: ReturnType<SessionPanel['pickerGeometry']>): void {
    const { modalW, modalH, modalRow, modalCol, inner } = g
    buf.fill(modalRow, modalCol, modalH, modalW, ' ', { bg: Colors.bgPanel })
    const hLine = '─'.repeat(inner)
    buf.write(modalRow,              modalCol, '┌' + hLine + '┐', { fg: Colors.borderActive, bg: Colors.bgPanel })
    buf.write(modalRow + modalH - 1, modalCol, '└' + hLine + '┘', { fg: Colors.borderActive, bg: Colors.bgPanel })
    for (let i = 1; i < modalH - 1; i++) {
      buf.write(modalRow + i, modalCol,            '│', { fg: Colors.borderActive, bg: Colors.bgPanel })
      buf.write(modalRow + i, modalCol + modalW - 1,'│', { fg: Colors.borderActive, bg: Colors.bgPanel })
      buf.fill(modalRow + i, modalCol + 1, 1, inner, ' ', { bg: Colors.bgPanel })
    }
    buf.write(modalRow, modalCol + 2, ` ${title} `, { fg: Colors.textBright, bg: Colors.bgPanel, bold: true })
  }

  // ── Picker click ──────────────────────────────────────────────────────────

  private handlePickerClick(row: number, col: number): boolean {
    const r = this.inner

    if (this.pickerStep === 'provider') {
      const g = this.pickerGeometry(r, this.pickerProviders.length)
      // Click outside → close
      if (row < g.modalRow || row >= g.modalRow + g.modalH || col < g.modalCol || col >= g.modalCol + g.modalW) {
        this.modelPickerOpen = false; this.onUpdate(); return true
      }
      const itemRow = row - (g.modalRow + 1)
      if (itemRow >= 0 && itemRow < this.pickerProviders.length) {
        this.selectProvider(itemRow)
      }
      return true
    }

    // step = 'model'
    if (this.pickerLoading) return true

    const visibleCount = Math.min(this.pickerModels.length, MAX_PICKER_VISIBLE)
    const scrollable   = this.pickerModels.length > MAX_PICKER_VISIBLE
    const g = this.pickerGeometry(r, visibleCount + (scrollable ? 1 : 0))

    // Click outside → close
    if (row < g.modalRow || row >= g.modalRow + g.modalH || col < g.modalCol || col >= g.modalCol + g.modalW) {
      this.modelPickerOpen = false; this.onUpdate(); return true
    }

    const itemRow = row - (g.modalRow + 1)
    if (itemRow >= 0 && itemRow < visibleCount) {
      const modelIdx = this.pickerScrollOffset + itemRow
      const picked   = this.pickerModels[modelIdx]
      if (picked) {
        this.selectedModel  = picked
        this.modelPickerIdx = modelIdx
        this.lines.push({ role: 'system', text: `Model set to ${picked.label}` })
        this.modelPickerOpen = false
        this.onUpdate()
      }
    }
    return true
  }

  // ── Picker render ─────────────────────────────────────────────────────────

  private renderModelPicker(buf: CellBuffer, r: { row: number; col: number; height: number; width: number }): void {
    if (this.pickerStep === 'provider') {
      const provs = this.pickerProviders
      const g = this.pickerGeometry(r, provs.length)
      this.drawPickerFrame(buf, 'Select Provider', g)
      for (let i = 0; i < provs.length; i++) {
        const sel = i === this.pickerProviderIdx
        const label = (sel ? '► ' : '  ') + provs[i]!.name
        buf.write(g.modalRow + 1 + i, g.modalCol + 1,
          label.substring(0, g.inner).padEnd(g.inner),
          { fg: sel ? Colors.bg : Colors.text, bg: sel ? Colors.accent : Colors.bgPanel, bold: sel })
      }
      return
    }

    // step = 'model'
    if (this.pickerLoading) {
      const g = this.pickerGeometry(r, 1)
      this.drawPickerFrame(buf, 'Loading models…', g)
      buf.write(g.modalRow + 1, g.modalCol + 2, '⣾ Fetching from provider…', { fg: Colors.textDim, bg: Colors.bgPanel })
      return
    }

    const models       = this.pickerModels
    const visibleCount = Math.min(models.length, MAX_PICKER_VISIBLE)
    const scrollable   = models.length > MAX_PICKER_VISIBLE
    const prov         = this.pickerProviders[this.pickerProviderIdx]
    const title        = prov ? `${prov.name} models` : 'Select Model'
    const contentRows  = visibleCount + (scrollable ? 1 : 0)
    const g            = this.pickerGeometry(r, contentRows)

    this.drawPickerFrame(buf, title, g)

    for (let i = 0; i < visibleCount; i++) {
      const modelIdx  = this.pickerScrollOffset + i
      const m         = models[modelIdx]
      if (!m) break
      const selected  = modelIdx === this.modelPickerIdx
      const isCurrent = this.selectedModel?.id === m.id
      const prefix    = selected ? '► ' : '  '
      const suffix    = isCurrent ? ' ✓' : ''
      const label     = (prefix + m.label + suffix).substring(0, g.inner).padEnd(g.inner)
      buf.write(g.modalRow + 1 + i, g.modalCol + 1, label, {
        fg: selected ? Colors.bg : Colors.text, bg: selected ? Colors.accent : Colors.bgPanel, bold: selected,
      })
    }

    // Scroll indicator at the bottom row
    if (scrollable) {
      const more  = models.length - this.pickerScrollOffset - visibleCount
      const above = this.pickerScrollOffset > 0
      let indicator = ''
      if (above && more > 0) indicator = `  ▲ scroll  ▼ ${more} more`
      else if (above)        indicator = `  ▲ scroll up`
      else if (more > 0)     indicator = `  ▼ ${more} more  (scroll)`
      buf.write(g.modalRow + 1 + visibleCount, g.modalCol + 1,
        indicator.substring(0, g.inner).padEnd(g.inner), { fg: Colors.textDim, bg: Colors.bgPanel })
    }
  }

  onKey(e: KeyEvent): boolean {
    if (this.modelPickerOpen) {
      if (e.key === 'escape') {
        if (this.pickerStep === 'model' && this.pickerProviders.length > 1) {
          // Go back to provider selection
          this.pickerStep = 'provider'; this.onUpdate(); return true
        }
        this.modelPickerOpen = false; this.onUpdate(); return true
      }

      if (this.pickerStep === 'provider') {
        if (e.key === 'arrow_up')   { this.pickerProviderIdx = Math.max(0, this.pickerProviderIdx - 1); this.onUpdate(); return true }
        if (e.key === 'arrow_down') { this.pickerProviderIdx = Math.min(this.pickerProviders.length - 1, this.pickerProviderIdx + 1); this.onUpdate(); return true }
        if (e.key === 'enter')      { this.selectProvider(this.pickerProviderIdx); return true }
        return true
      }

      // step = 'model'
      if (!this.pickerLoading) {
        if (e.key === 'arrow_up') {
          this.modelPickerIdx = Math.max(0, this.modelPickerIdx - 1)
          if (this.modelPickerIdx < this.pickerScrollOffset) this.pickerScrollOffset = this.modelPickerIdx
          this.onUpdate(); return true
        }
        if (e.key === 'arrow_down') {
          this.modelPickerIdx = Math.min(this.pickerModels.length - 1, this.modelPickerIdx + 1)
          if (this.modelPickerIdx >= this.pickerScrollOffset + MAX_PICKER_VISIBLE)
            this.pickerScrollOffset = this.modelPickerIdx - MAX_PICKER_VISIBLE + 1
          this.onUpdate(); return true
        }
        if (e.key === 'enter') {
          const picked = this.pickerModels[this.modelPickerIdx]
          if (picked) { this.selectedModel = picked; this.lines.push({ role: 'system', text: `Model set to ${picked.label}` }) }
          this.modelPickerOpen = false; this.onUpdate(); return true
        }
      }
      return true
    }

    // ── Slash command autocomplete ───────────────────────────────────────
    const acMatches = this.acMatches()
    if (acMatches.length > 0) {
      if (e.key === 'arrow_up')   { this.acIndex = (this.acIndex - 1 + acMatches.length) % acMatches.length; this.onUpdate(); return true }
      if (e.key === 'arrow_down') { this.acIndex = (this.acIndex + 1) % acMatches.length; this.onUpdate(); return true }
      if (e.key === 'tab') {
        const pick = acMatches[this.acIndex] ?? acMatches[0]!
        this.inputBuf = pick.name + ' '
        this.acIndex = 0
        this.onUpdate(); return true
      }
      if (e.key === 'enter') {
        // If exactly one match or a selection, run it; else complete
        const pick = acMatches[this.acIndex] ?? acMatches[0]!
        if (this.inputBuf === pick.name || acMatches.length === 1) {
          this.inputBuf = pick.name
          this.submit()
        } else {
          this.inputBuf = pick.name + ' '
        }
        this.acIndex = 0
        this.onUpdate(); return true
      }
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
    if (e.key === 'arrow_left') {
      this.hScroll = Math.max(0, this.hScroll - 8)
      this.onUpdate()
      return true
    }
    if (e.key === 'arrow_right') {
      this.hScroll += 8
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
    if (this.modelPickerOpen) {
      if (e.button === 'scroll_up' && this.pickerStep === 'model') {
        this.pickerScrollOffset = Math.max(0, this.pickerScrollOffset - 1)
        this.onUpdate(); return true
      }
      if (e.button === 'scroll_down' && this.pickerStep === 'model') {
        const max = Math.max(0, this.pickerModels.length - MAX_PICKER_VISIBLE)
        this.pickerScrollOffset = Math.min(max, this.pickerScrollOffset + 1)
        this.onUpdate(); return true
      }
      if (e.button === 'left' && e.action === 'press') return this.handlePickerClick(e.row, e.col)
      return true
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

  /** True if a line is structured content (table/code) — kept intact for h-scroll. */
  private isWideContent(text: string): boolean {
    return text.includes('│') || text.includes('|') ||
           /^\s*```/.test(text) || /^\s{4,}/.test(text)
  }

  /** Word-wrap prose to `width`; keep table/code lines as single (h-scrollable) lines. */
  private buildDisplayLines(width: number): ChatLine[] {
    const out: ChatLine[] = []
    for (const line of this.lines) {
      if (line.text.length <= width || this.isWideContent(line.text)) {
        out.push(line)
        continue
      }
      // Word-wrap prose
      const words = line.text.split(' ')
      let cur = ''
      for (const w of words) {
        if (cur.length === 0) { cur = w }
        else if (cur.length + 1 + w.length <= width) { cur += ' ' + w }
        else { out.push({ role: line.role, text: cur }); cur = w }
        // Hard-break a single word longer than width
        while (cur.length > width) {
          out.push({ role: line.role, text: cur.substring(0, width) })
          cur = cur.substring(width)
        }
      }
      if (cur.length > 0) out.push({ role: line.role, text: cur })
    }
    return out
  }

  private maxScroll(): number {
    const r = this.inner
    const displayRows = r.height - 1
    const contentWidth = r.width
    return Math.max(0, this.buildDisplayLines(contentWidth).length - displayRows)
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
        this.lines.push({ role: 'system', text: 'Commands: /help /model /config /clear /tokens' })
        break
      case 'config':
      case 'settings':
        this.onNavigate?.('config')
        this.lines.push({ role: 'system', text: 'Opening Config…' })
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

  private async fetchPickerModels(provider: Provider): Promise<void> {
    let models: ModelEntry[] = []
    try {
      models = await listModels(provider)
    } catch { /* network or auth error */ }

    // Fall back to hardcoded list for this provider
    if (models.length === 0) {
      models = FALLBACK_MODELS.filter(m => m.provider === provider)
    }

    this.pickerModels = models
    // Restore cursor to currently selected model if it's in this list
    if (this.selectedModel?.provider === provider) {
      const idx = models.findIndex(m => m.id === this.selectedModel!.id)
      this.modelPickerIdx = Math.max(0, idx)
      this.pickerScrollOffset = Math.max(0, this.modelPickerIdx - MAX_PICKER_VISIBLE + 1)
    } else {
      this.modelPickerIdx     = 0
      this.pickerScrollOffset = 0
    }
    this.pickerLoading = false
    this.onUpdate()
  }

  private async runAgentLoop(): Promise<void> {
    this.streaming = true
    await runHook('SessionStart', {})

    const provider = this.selectedModel?.provider ?? defaultProvider()
    const adapter  = createAdapter(provider)
    const modelId  = this.selectedModel?.id ?? adapter.defaultModel
    const loopOpts = this.selectedModel
      ? { adapter, model: this.selectedModel.id, maxTurns: 20 }
      : { adapter, maxTurns: 20 }

    const startTime = Date.now()
    let lastStats: SessionStats = { status: 'running', model: modelId, inputTokens: 0, outputTokens: 0, toolCalls: 0, turns: 0, startTime }
    this.onStats?.(lastStats)

    let currentLine: ChatLine | undefined
    let hadError = false
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
        } else if (event.type === 'stats') {
          lastStats = {
            status: 'running', model: event.model,
            inputTokens: event.inputTokens, outputTokens: event.outputTokens,
            toolCalls: event.toolCalls, turns: event.turns, startTime,
          }
          this.onStats?.(lastStats)
        } else if (event.type === 'error') {
          hadError = true
          this.lines.push({ role: 'system', text: `Error: ${event.error.message}` })
          this.onUpdate()
        }
      }
    } catch (err) {
      hadError = true
      const msg = err instanceof Error ? err.message : String(err)
      this.lines.push({ role: 'system', text: `Error: ${msg}` })
      this.onUpdate()
    } finally {
      this.streaming = false
      this.onStats?.({ ...lastStats, status: hadError ? 'error' : 'done' })
      await runHook('SessionStop', {})
      this.onUpdate()
    }
  }

}
