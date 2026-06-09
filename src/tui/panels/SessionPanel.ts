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
import { ScrollableList } from '../widgets/ScrollableList.js'
import { nextLaureate, type Laureate } from '../../core/nobel.js'
import { rolloutStore, type RolloutHandle, type RolloutEvent } from '../../core/rollout.js'

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

/**
 * Make text safe for the single-width monospace cell buffer.
 *
 * The buffer writes one UTF-16 code unit per cell, so astral characters
 * (emoji, which are surrogate pairs) split into two broken cells ("◆◆").
 * We replace common emoji with a tasteful ASCII glyph and strip the rest,
 * plus zero-width joiners and variation selectors that leave stray cells.
 */
function sanitizeForDisplay(text: string): string {
  let out = ''
  for (const ch of text) {                         // iterate by code point
    const cp = ch.codePointAt(0) ?? 0
    if (cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f)) continue  // ZWJ / VS
    if (cp > 0xffff) { out += EMOJI_ASCII[ch] ?? '' ; continue }   // astral → glyph or drop
    out += ch
  }
  return out
}

const EMOJI_ASCII: Record<string, string> = {
  '👋': ':)', '😀': ':)', '😊': ':)', '🙂': ':)', '👍': '(y)',
  '🎉': '*', '✨': '*', '🚀': '^', '🔥': '!', '❤️': '<3', '💡': '(i)',
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
  { name: '/help',   desc: 'Show available commands'                  },
  { name: '/model',  desc: 'Select model (provider → model)'          },
  { name: '/chat',   desc: 'Toggle plain chat (no tools, cheaper)'    },
  { name: '/resume', desc: 'List & reload saved sessions (/resume N)' },
  { name: '/config', desc: 'Open Config tab (API keys, login)'        },
  { name: '/clear',  desc: 'Clear the conversation'                   },
  { name: '/tokens', desc: 'Show approximate token count'             },
] as const

interface SessionRecord {
  name:          string
  session:       Session
  lines:         ChatLine[]
  inputBuf:      string
  scrollOffset:  number
  hScroll:       number
  streaming:     boolean
  selectedModel: ModelEntry | null
  chatMode:      boolean
  status:        'idle' | 'running' | 'done' | 'error'
  lastStats:     SessionStats | null
  rollout:       RolloutHandle | null   // append-only JSONL persistence
}

export class SessionPanel extends Panel {
  // Multi-session: the active record is the interactive one
  private sessions: SessionRecord[] = []
  private activeIdx = 0

  private onUpdate: () => void
  private onStats?: (s: SessionStats) => void
  private onNavigate?: (target: 'config') => void
  private onCopy?: (text: string) => void
  private acIndex = 0   // autocomplete selection index
  // Text selection (viewport content coords: 0-based within inner rect)
  private selAnchor: { row: number; col: number } | null = null
  private selFocus:  { row: number; col: number } | null = null
  private selecting = false
  private lastVisible: ChatLine[] = []   // snapshot of rendered lines for text extraction
  private lastContentWidth = 0
  private scrollbarDragging = false
  private scrollbarDragStartY = 0
  private scrollbarDragStartOffset = 0
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
  // New-session menu (uses the reusable ScrollableList)
  private newSessionOpen = false
  private newSessionList = new ScrollableList(8)
  private newSessionTargets: ({ kind: 'standard' } | { kind: 'provider'; provider: Provider })[] = []

  constructor(
    rect: Rect,
    onUpdate: () => void,
    onStats?: (s: SessionStats) => void,
    onNavigate?: (target: 'config') => void,
    onCopy?: (text: string) => void,
  ) {
    super(rect)
    this.onUpdate = onUpdate
    if (onStats) this.onStats = onStats
    if (onNavigate) this.onNavigate = onNavigate
    if (onCopy) this.onCopy = onCopy
    // First session — named after the first laureate
    this.sessions.push(this.makeRecord(nextLaureate(new Set())))
  }

  private makeRecord(l: Laureate, model: ModelEntry | null = null, chatMode = false): SessionRecord {
    return {
      name:          l.name,
      session:       new Session(),
      lines:         [{ role: 'system', text: `factory v0.4.0 — session "${l.name}" — type a message or /help` }],
      inputBuf:      '',
      scrollOffset:  0,
      hScroll:       0,
      streaming:     false,
      selectedModel: model,
      chatMode,
      status:        'idle',
      lastStats:     null,
      rollout:       rolloutStore.create(l.name, model?.id ?? 'default'),
    }
  }

  // ── Active-record accessors (proxy so existing code reads the active session) ─
  private get active(): SessionRecord { return this.sessions[this.activeIdx]! }
  private get session(): Session { return this.active.session }
  private get lines(): ChatLine[] { return this.active.lines }
  private set lines(v: ChatLine[]) { this.active.lines = v }
  private get inputBuf(): string { return this.active.inputBuf }
  private set inputBuf(v: string) { this.active.inputBuf = v }
  private get scrollOffset(): number { return this.active.scrollOffset }
  private set scrollOffset(v: number) { this.active.scrollOffset = v }
  private get hScroll(): number { return this.active.hScroll }
  private set hScroll(v: number) { this.active.hScroll = v }
  private get streaming(): boolean { return this.active.streaming }
  private set streaming(v: boolean) { this.active.streaming = v }
  private get selectedModel(): ModelEntry | null { return this.active.selectedModel }
  private set selectedModel(v: ModelEntry | null) { this.active.selectedModel = v }
  private get chatMode(): boolean { return this.active.chatMode }
  private set chatMode(v: boolean) { this.active.chatMode = v }

  getSession(): Session { return this.session }

  getSelectedModel(): ModelEntry | null { return this.selectedModel }

  /** Metadata for every session — used by the Agents panel as a switcher. */
  sessionMetas(): { name: string; status: SessionRecord['status']; active: boolean; stats: SessionStats | null }[] {
    return this.sessions.map((s, i) => ({ name: s.name, status: s.status, active: i === this.activeIdx, stats: s.lastStats }))
  }

  switchTo(idx: number): void {
    if (idx >= 0 && idx < this.sessions.length) {
      this.activeIdx = idx
      this.clearSelection()
      this.onUpdate()
    }
  }

  /** Reload a saved rollout into a new active session (replays its events). */
  private resumeFrom(id: string, name: string): void {
    const events: RolloutEvent[] = rolloutStore.load(id)
    const rec = this.makeRecord(nextLaureate(new Set(this.sessions.map(s => s.name))))
    rec.name = `${name}*`   // resumed marker
    rec.lines = [{ role: 'system', text: `Resumed session "${name}" (${events.length} events).` }]
    for (const ev of events) {
      if (ev.type === 'user') {
        rec.lines.push({ role: 'user', text: ev.text })
        rec.session.addMessage({ role: 'user', content: ev.text })
      } else if (ev.type === 'assistant') {
        rec.lines.push({ role: 'assistant', text: ev.text })
        rec.session.addMessage({ role: 'assistant', content: ev.text })
      } else if (ev.type === 'system') {
        rec.lines.push({ role: 'system', text: ev.text })
      } else if (ev.type === 'tool') {
        rec.lines.push({ role: 'system', text: ev.name === 'result' ? `  → ${ev.result ?? ''}` : `  tool: ${ev.name}` })
      }
    }
    this.sessions.push(rec)
    this.activeIdx = this.sessions.length - 1
    this.clearSelection()
    this.onUpdate()
  }

  toggleChatMode(): void {
    this.chatMode = !this.chatMode
    this.lines.push({ role: 'system', text: this.chatMode
      ? 'Chat mode ON — tools disabled (cheap plain chat).'
      : 'Chat mode OFF — agent tools enabled (bash/read/write/web-fetch).' })
    this.onUpdate()
  }

  /** Open the "New Session" menu: standard agent or a configured provider. */
  openNewSessionMenu(): void {
    const ALL: { provider: Provider; name: string }[] = [
      { provider: 'anthropic', name: 'Anthropic Claude' },
      { provider: 'openai',    name: 'OpenAI'           },
    ]
    const configured = ALL.filter(p =>
      !!(store.getKey(p.provider, p.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'))
    )

    this.newSessionTargets = [{ kind: 'standard' }]
    const rows = [{ text: '⚡ Standard AgentFactory agent' }]
    if (configured.length > 0) {
      rows.push({ text: '── Providers ──', header: true } as never)
      for (const p of configured) {
        this.newSessionTargets.push({ kind: 'provider', provider: p.provider })
        rows.push({ text: `◆ ${p.name} session` })
      }
    }
    this.newSessionList.setRows(rows)
    this.newSessionOpen = true
    this.onUpdate()
  }

  private confirmNewSession(): void {
    // selectedIndex counts headers too; map via row position to a target.
    // Build the same row→target mapping used when constructing rows.
    const sel = this.newSessionList.selectedIndex
    // Count non-header rows up to and including sel to find target index.
    // Simpler: targets are in order, header is the only non-target row.
    // standard=row0→target0; header=row1; provider rows → targets 1..n
    let targetIdx: number
    if (sel === 0) targetIdx = 0
    else targetIdx = sel - 1  // one header row sits at index 1
    const target = this.newSessionTargets[targetIdx]
    this.newSessionOpen = false

    // Create a brand-new named session (don't clobber the current one)
    const used = new Set(this.sessions.map(s => s.name))
    const laureate = nextLaureate(used)
    const rec = this.makeRecord(laureate)
    this.sessions.push(rec)
    this.activeIdx = this.sessions.length - 1
    this.clearSelection()

    if (!target || target.kind === 'standard') {
      rec.lines = [{ role: 'system', text: `New session "${laureate.name}" — standard AgentFactory agent.` }]
      this.onUpdate()
      return
    }
    // Provider session → open the model picker for that provider
    rec.lines = [{ role: 'system', text: `New session "${laureate.name}" — ${target.provider}. Choose a model.` }]
    this.onUpdate()
    this.pickerProviders   = [{ provider: target.provider, name: target.provider === 'anthropic' ? 'Anthropic Claude' : 'OpenAI' }]
    this.pickerProviderIdx = 0
    this.modelPickerOpen   = true
    this.selectProvider(0)
  }

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

    // Calculate input row count first (needed for display calculation)
    const prompt = this.streaming ? '… ' : '> '
    const cursor = this.focused && !this.streaming ? '█' : ''
    const allText = this.inputBuf + cursor
    const usable = r.width - prompt.length
    const inputLines = this.wrapText(allText, usable)
    const inputRowCount = Math.min(5, Math.max(1, inputLines.length))

    const displayRows = r.height - inputRowCount   // account for multi-line input
    const inputRow = r.row + displayRows  // first row of input area
    const maxScroll = this.maxScroll()
    const hasScrollbar = maxScroll > 0
    // Reserve right column for scrollbar when content overflows
    const contentWidth = hasScrollbar ? r.width - 1 : r.width
    const scrollbarCol = r.col + r.width - 1

    // Build display lines: word-wrap prose, keep table/code lines intact (h-scroll)
    const lines = this.buildDisplayLines(contentWidth)
    const start = Math.max(0, lines.length - displayRows - this.scrollOffset)
    const visible = lines.slice(start, start + displayRows)

    // Snapshot for text extraction on copy
    this.lastVisible = visible
    this.lastContentWidth = contentWidth

    // Clamp horizontal scroll to the widest visible line
    const widest = visible.reduce((m, l) => Math.max(m, l.text.length), 0)
    const maxH = Math.max(0, widest - contentWidth)
    if (this.hScroll > maxH) this.hScroll = maxH

    const selRange = this.normalizedSelection()
    let anyClipped = false
    for (let i = 0; i < displayRows; i++) {
      const line = visible[i]
      // Table rows (markdown `|…|`) get a boxed look: tinted bg + edge markers
      const isTable = !!line && line.text.includes('|')
      const rowBg = isTable ? Colors.bgActive : Colors.bgPanel
      buf.fill(r.row + i, r.col, 1, contentWidth, ' ', { bg: rowBg })
      if (line) {
        const fg = line.role === 'user'
          ? Colors.accent
          : line.role === 'system'
          ? Colors.textDim
          : Colors.text
        const clipped = line.text.substring(this.hScroll, this.hScroll + contentWidth)
        const overflowR = line.text.length > this.hScroll + contentWidth
        if (overflowR) anyClipped = true
        buf.write(r.row + i, r.col, clipped, { fg, bg: rowBg })

        // Lateral-scroll edge markers on boxed table rows
        if (isTable) {
          if (this.hScroll > 0) buf.write(r.row + i, r.col, '◂', { fg: Colors.warning, bg: rowBg })
          if (overflowR)        buf.write(r.row + i, r.col + contentWidth - 1, '▸', { fg: Colors.warning, bg: rowBg })
        }

        // Selection highlight (reverse video) for cells inside the range
        if (selRange) {
          const sel = this.rowSelectionCols(selRange, i, clipped.length)
          if (sel) {
            for (let c = sel.from; c < sel.to; c++) {
              const ch = clipped[c] ?? ' '
              buf.write(r.row + i, r.col + c, ch, { fg: Colors.bg, bg: Colors.accent })
            }
          }
        }
      }
    }

    // Horizontal scroll hint — shown on the last content row when text is clipped
    if (anyClipped || this.hScroll > 0) {
      const hint = ` ◂ ← → ▸  scroll table (col ${this.hScroll}) `
      const hintCol = r.col + Math.max(0, contentWidth - hint.length)
      buf.write(r.row + displayRows - 1, hintCol, hint.substring(0, contentWidth), { fg: Colors.bg, bg: Colors.warning, bold: true })
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

    // Input bar with multi-line wrap
    for (let i = 0; i < inputRowCount; i++) {
      const row = inputRow + i
      buf.fill(row, r.col, 1, r.width, ' ', { bg: Colors.bg })
      const lineText = i === 0 ? prompt + (inputLines[i] ?? '') : '  ' + (inputLines[i] ?? '')
      buf.write(row, r.col, lineText.substring(0, r.width), { fg: Colors.text, bg: Colors.bg })
    }

    // Slash command autocomplete (above the input bar)
    this.renderAutocomplete(buf, r, inputRow)

    // Overlays
    if (this.newSessionOpen) this.renderNewSessionMenu(buf, r)
    if (this.modelPickerOpen) this.renderModelPicker(buf, r)
  }

  private renderNewSessionMenu(buf: CellBuffer, r: { row: number; col: number; height: number; width: number }): void {
    const modalW   = Math.min(r.width - 4, 46)
    const rows     = this.newSessionList.shownCount + (this.newSessionList.isScrollable ? 1 : 0)
    const modalH   = rows + 2
    const modalRow = r.row + Math.max(0, Math.floor((r.height - modalH) / 2))
    const modalCol = r.col + Math.floor((r.width - modalW) / 2)
    const inner    = modalW - 2

    buf.fill(modalRow, modalCol, modalH, modalW, ' ', { bg: Colors.bgPanel })
    const hLine = '─'.repeat(inner)
    buf.write(modalRow,              modalCol, '┌' + hLine + '┐', { fg: Colors.borderActive, bg: Colors.bgPanel })
    buf.write(modalRow + modalH - 1, modalCol, '└' + hLine + '┘', { fg: Colors.borderActive, bg: Colors.bgPanel })
    for (let i = 1; i < modalH - 1; i++) {
      buf.write(modalRow + i, modalCol,            '│', { fg: Colors.borderActive, bg: Colors.bgPanel })
      buf.write(modalRow + i, modalCol + modalW-1, '│', { fg: Colors.borderActive, bg: Colors.bgPanel })
    }
    buf.write(modalRow, modalCol + 2, ' New Session ', { fg: Colors.textBright, bg: Colors.bgPanel, bold: true })
    this.newSessionList.render(buf, modalRow + 1, modalCol + 1, inner)
  }

  /** Commands matching the current input, or [] if autocomplete isn't active. */
  private wrapText(text: string, width: number): string[] {
    if (width <= 0) return [text]
    const lines = []
    for (let i = 0; i < text.length; i += width) {
      lines.push(text.slice(i, i + width))
    }
    return lines.length > 0 ? lines : ['']
  }

  getChatMode(): boolean {
    return this.chatMode
  }

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
    // New-session menu intercepts all keys when open
    if (this.newSessionOpen) {
      if (e.key === 'escape')     { this.newSessionOpen = false; this.onUpdate(); return true }
      if (e.key === 'arrow_up')   { this.newSessionList.moveUp();   this.onUpdate(); return true }
      if (e.key === 'arrow_down') { this.newSessionList.moveDown(); this.onUpdate(); return true }
      if (e.key === 'enter')      { this.confirmNewSession(); return true }
      return true
    }

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
      this.clearSelection()
      this.onUpdate()
      return true
    }
    return false
  }

  override onMouse(e: MouseEvent): boolean {
    // New-session menu intercepts all mouse when open
    if (this.newSessionOpen) {
      if (e.button === 'scroll_up')   { this.newSessionList.scrollUp();   this.onUpdate(); return true }
      if (e.button === 'scroll_down') { this.newSessionList.scrollDown(); this.onUpdate(); return true }
      if (e.button === 'left' && e.action === 'press') {
        const r = this.inner
        const modalW   = Math.min(r.width - 4, 46)
        const rows     = this.newSessionList.shownCount + (this.newSessionList.isScrollable ? 1 : 0)
        const modalH   = rows + 2
        const modalRow = r.row + Math.max(0, Math.floor((r.height - modalH) / 2))
        const modalCol = r.col + Math.floor((r.width - modalW) / 2)
        if (e.row < modalRow || e.row >= modalRow + modalH || e.col < modalCol || e.col >= modalCol + modalW) {
          this.newSessionOpen = false; this.onUpdate(); return true
        }
        const vRow = e.row - (modalRow + 1)
        if (this.newSessionList.selectAtViewportRow(vRow) >= 0) this.confirmNewSession()
      }
      return true
    }

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

    // Release — ends drag or finalises a text selection (auto-copy)
    if (e.button === 'left' && e.action === 'release') {
      if (this.scrollbarDragging) { this.scrollbarDragging = false; return true }
      if (this.selecting) {
        this.selecting = false
        if (this.hasSelection()) this.copySelection()
        this.onUpdate()
        return true
      }
      return false
    }

    // Text selection: press (in content area, not scrollbar) starts a selection
    const inContent = e.row >= r.row && e.row < r.row + displayRows && e.col >= r.col && e.col < scrollbarCol
    if (e.button === 'left' && e.action === 'press' && inContent &&
        !(maxScroll > 0 && e.col === scrollbarCol)) {
      const vRow = e.row - r.row
      const vCol = e.col - r.col + this.hScroll
      this.selAnchor = { row: vRow, col: vCol }
      this.selFocus  = { row: vRow, col: vCol }
      this.selecting = true
      this.onUpdate()
      return true
    }

    // Drag move while selecting → extend the focus
    if (e.button === 'left' && e.action === 'move' && this.selecting) {
      const vRow = Math.max(0, Math.min(displayRows - 1, e.row - r.row))
      const vCol = Math.max(0, e.col - r.col) + this.hScroll
      this.selFocus = { row: vRow, col: vCol }
      this.onUpdate()
      return true
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
    for (const raw of this.lines) {
      // A single ChatLine may contain newlines (multi-line model output).
      // Split on \n FIRST so each physical line is laid out independently.
      const physical = sanitizeForDisplay(raw.text).split('\n')
      for (const text of physical) {
        const line = { role: raw.role, text }
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
    }
    return out
  }

  private maxScroll(): number {
    const r = this.inner
    const displayRows = r.height - 1
    const contentWidth = r.width
    return Math.max(0, this.buildDisplayLines(contentWidth).length - displayRows)
  }

  // ── Text selection / clipboard ──────────────────────────────────────────────

  hasSelection(): boolean {
    const s = this.normalizedSelection()
    return s !== null && !(s.startRow === s.endRow && s.startCol === s.endCol)
  }

  clearSelection(): void {
    this.selAnchor = null
    this.selFocus = null
    this.selecting = false
  }

  /** Normalised selection so start ≤ end in reading order. Null if none. */
  private normalizedSelection(): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
    if (!this.selAnchor || !this.selFocus) return null
    const a = this.selAnchor, b = this.selFocus
    const before = a.row < b.row || (a.row === b.row && a.col <= b.col)
    const s = before ? a : b
    const e = before ? b : a
    return { startRow: s.row, startCol: s.col, endRow: e.row, endCol: e.col }
  }

  /** Column span [from,to) selected on viewport row `vRow`, accounting for hScroll. */
  private rowSelectionCols(
    sel: { startRow: number; startCol: number; endRow: number; endCol: number },
    vRow: number, lineLen: number,
  ): { from: number; to: number } | null {
    if (vRow < sel.startRow || vRow > sel.endRow) return null
    // Selection cols are in content coords; convert to clipped (subtract hScroll)
    const startC = vRow === sel.startRow ? sel.startCol : 0
    const endC   = vRow === sel.endRow   ? sel.endCol   : this.lastContentWidth
    const from = Math.max(0, startC - this.hScroll)
    const to   = Math.min(lineLen, Math.max(0, endC - this.hScroll))
    if (to <= from) return null
    return { from, to }
  }

  /** Extract the selected text from the last rendered viewport. */
  getSelectedText(): string {
    const sel = this.normalizedSelection()
    if (!sel) return ''
    const parts: string[] = []
    for (let row = sel.startRow; row <= sel.endRow; row++) {
      const line = this.lastVisible[row]
      if (!line) continue
      const startC = row === sel.startRow ? sel.startCol : 0
      const endC   = row === sel.endRow   ? sel.endCol   : line.text.length
      parts.push(line.text.substring(startC, endC).replace(/\s+$/, ''))
    }
    return parts.join('\n')
  }

  /** Copy the current selection (or whole visible buffer if none) to clipboard. */
  copySelection(): void {
    const text = this.hasSelection()
      ? this.getSelectedText()
      : this.lastVisible.map(l => l.text.replace(/\s+$/, '')).join('\n')
    if (text.length > 0) this.onCopy?.(text)
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
    this.active.rollout?.append({ type: 'user', text })
    this.scrollOffset = 0
    this.onUpdate()
    void this.runAgentLoop(this.active)   // capture record so switching is safe
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
        this.lines.push({ role: 'system', text: 'Commands: /help /model /chat /resume /config /clear /tokens' })
        break
      case 'chat':
        this.toggleChatMode()
        break
      case 'resume': {
        const arg = parts.slice(1).join(' ').trim()
        const saved = rolloutStore.list()
        if (!arg) {
          if (saved.length === 0) { this.lines.push({ role: 'system', text: 'No saved sessions yet.' }); break }
          this.lines.push({ role: 'system', text: 'Saved sessions (use /resume N):' })
          saved.slice(0, 12).forEach((m, i) => {
            this.lines.push({ role: 'system', text: `  ${i + 1}. ${m.name} · ${m.model} · ${m.createdAt.slice(0, 16).replace('T', ' ')}` })
          })
        } else {
          const n = parseInt(arg, 10)
          const meta = saved[n - 1]
          if (!meta) { this.lines.push({ role: 'system', text: `No saved session #${arg}.` }); break }
          this.resumeFrom(meta.id, meta.name)
        }
        break
      }
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

  private async runAgentLoop(rec: SessionRecord): Promise<void> {
    rec.streaming = true
    rec.status = 'running'
    await runHook('SessionStart', {})

    const provider = rec.selectedModel?.provider ?? defaultProvider()
    const adapter  = createAdapter(provider)
    const modelId  = rec.selectedModel?.id ?? adapter.defaultModel
    const loopOpts = rec.selectedModel
      ? { adapter, model: rec.selectedModel.id, maxTurns: 20, noTools: rec.chatMode }
      : { adapter, maxTurns: 20, noTools: rec.chatMode }

    const startTime = Date.now()
    const pushStats = (s: SessionStats) => { rec.lastStats = s; this.onStats?.(s) }
    let lastStats: SessionStats = { status: 'running', model: modelId, inputTokens: 0, outputTokens: 0, toolCalls: 0, turns: 0, startTime }
    pushStats(lastStats)

    let currentLine: ChatLine | undefined
    let hadError = false
    try {
      for await (const event of agentLoop(rec.session, loopOpts)) {
        if (event.type === 'text_delta') {
          if (!currentLine) {
            currentLine = { role: 'assistant', text: '' }
            rec.lines.push(currentLine)
          }
          currentLine.text += event.delta
          rec.scrollOffset = 0
          this.onUpdate()
        } else if (event.type === 'tool_start') {
          currentLine = undefined
          rec.lines.push({ role: 'system', text: `  tool: ${event.name}` })
          rec.rollout?.append({ type: 'tool', name: event.name })
          this.onUpdate()
        } else if (event.type === 'tool_result') {
          const preview = event.content.substring(0, 80).replace(/\n/g, ' ')
          rec.lines.push({ role: 'system', text: `  → ${preview}` })
          rec.rollout?.append({ type: 'tool', name: 'result', result: preview })
          currentLine = undefined
          this.onUpdate()
        } else if (event.type === 'turn_end') {
          if (currentLine && currentLine.text.length > 0) {
            rec.rollout?.append({ type: 'assistant', text: currentLine.text })
          }
          currentLine = undefined
        } else if (event.type === 'stats') {
          lastStats = {
            status: 'running', model: event.model,
            inputTokens: event.inputTokens, outputTokens: event.outputTokens,
            toolCalls: event.toolCalls, turns: event.turns, startTime,
          }
          rec.rollout?.append({ type: 'stats', input: event.inputTokens, output: event.outputTokens, toolCalls: event.toolCalls, turns: event.turns })
          pushStats(lastStats)
        } else if (event.type === 'error') {
          hadError = true
          rec.lines.push({ role: 'system', text: `Error: ${event.error.message}` })
          rec.rollout?.append({ type: 'system', text: `Error: ${event.error.message}` })
          this.onUpdate()
        }
      }
    } catch (err) {
      hadError = true
      const msg = err instanceof Error ? err.message : String(err)
      rec.lines.push({ role: 'system', text: `Error: ${msg}` })
      this.onUpdate()
    } finally {
      rec.streaming = false
      rec.status = hadError ? 'error' : 'done'
      pushStats({ ...lastStats, status: rec.status })
      await runHook('SessionStop', {})
      this.onUpdate()
    }
  }

}
