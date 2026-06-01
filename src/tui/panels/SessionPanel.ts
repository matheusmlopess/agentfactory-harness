import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { KeyEvent } from '../input/keyboard.js'
import type { MouseEvent } from '../input/mouse.js'
import type { Rect } from '../renderer/layout.js'
import { Colors } from '../renderer/theme.js'
import { Session } from '../../core/session.js'
import { agentLoop } from '../../core/agent-loop.js'
import { runHook } from '../../core/hooks.js'
import { createAdapter, defaultProvider } from '../../core/llm/index.js'
import type { Provider } from '../../core/llm/types.js'

interface ModelOption {
  provider: Provider
  model:    string
  label:    string
}

const MODEL_OPTIONS: readonly ModelOption[] = [
  { provider: 'anthropic', model: 'claude-opus-4-8',           label: 'Claude Opus 4.8'             },
  { provider: 'anthropic', model: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (default)' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5'            },
  { provider: 'openai',    model: 'gpt-4o',                    label: 'GPT-4o'                      },
  { provider: 'openai',    model: 'gpt-4o-mini',               label: 'GPT-4o mini'                 },
  { provider: 'openai',    model: 'o3',                        label: 'OpenAI o3'                   },
  { provider: 'openai',    model: 'o4-mini',                   label: 'OpenAI o4-mini'              },
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
  private selectedModel: ModelOption | null = null
  private modelPickerOpen = false
  private modelPickerIdx = 1  // default: Sonnet

  constructor(rect: Rect, onUpdate: () => void) {
    super(rect)
    this.session = new Session()
    this.onUpdate = onUpdate
    this.lines.push({ role: 'system', text: 'factory v0.4.0 — type a message or /help' })
  }

  getSession(): Session {
    return this.session
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
    const modelTag = this.selectedModel ? ` [${this.selectedModel.model}]` : ''
    const available = r.width - modelTag.length - 1
    const inputDisplay = (prompt + this.inputBuf + cursor).substring(0, available)
    buf.write(inputRow, r.col, inputDisplay, { fg: Colors.text, bg: Colors.bg })
    if (modelTag) {
      buf.write(inputRow, r.col + r.width - modelTag.length, modelTag, { fg: Colors.textDim, bg: Colors.bg })
    }

    // Model picker overlay
    if (this.modelPickerOpen) this.renderModelPicker(buf, r)
  }

  private renderModelPicker(buf: CellBuffer, r: { row: number; col: number; height: number; width: number }): void {
    const n = MODEL_OPTIONS.length
    const modalW = Math.min(r.width - 4, 54)
    const modalH = n + 3  // border top + items + border bottom + blank
    const modalRow = r.row + Math.max(0, Math.floor((r.height - modalH) / 2))
    const modalCol = r.col + Math.floor((r.width - modalW) / 2)
    const inner = modalW - 2

    buf.fill(modalRow, modalCol, modalH, modalW, ' ', { bg: Colors.bgPanel })
    const hLine = '─'.repeat(inner)
    buf.write(modalRow,             modalCol, '┌' + hLine + '┐', { fg: Colors.borderActive, bg: Colors.bgPanel })
    buf.write(modalRow + modalH - 1, modalCol, '└' + hLine + '┘', { fg: Colors.borderActive, bg: Colors.bgPanel })
    for (let i = 1; i < modalH - 1; i++) {
      buf.write(modalRow + i, modalCol, '│', { fg: Colors.borderActive, bg: Colors.bgPanel })
      buf.write(modalRow + i, modalCol + modalW - 1, '│', { fg: Colors.borderActive, bg: Colors.bgPanel })
    }
    buf.write(modalRow, modalCol + 2, ' Select Model ', { fg: Colors.textBright, bg: Colors.bgPanel, bold: true })

    for (let i = 0; i < n; i++) {
      const opt = MODEL_OPTIONS[i]!
      const selected = i === this.modelPickerIdx
      const isCurrent = this.selectedModel?.model === opt.model
      const prefix = selected ? '► ' : '  '
      const suffix = isCurrent ? ' ✓' : '  '
      const provTag = opt.provider === 'anthropic' ? 'Anthropic' : 'OpenAI   '
      const labelMax = inner - provTag.length - suffix.length - 2
      const label = (prefix + opt.label).substring(0, labelMax).padEnd(labelMax)
      const fg  = selected ? Colors.bg          : Colors.text
      const bg  = selected ? Colors.accent      : Colors.bgPanel
      const pfg = selected ? Colors.bg          : Colors.textDim
      buf.write(modalRow + 1 + i, modalCol + 1, label, { fg, bg, bold: selected })
      buf.write(modalRow + 1 + i, modalCol + 1 + labelMax, suffix, { fg, bg })
      buf.write(modalRow + 1 + i, modalCol + 1 + labelMax + suffix.length, provTag, { fg: pfg, bg })
    }
  }

  onKey(e: KeyEvent): boolean {
    // Model picker intercepts all keys when open
    if (this.modelPickerOpen) {
      if (e.key === 'escape') {
        this.modelPickerOpen = false
        this.onUpdate(); return true
      }
      if (e.key === 'arrow_up') {
        this.modelPickerIdx = Math.max(0, this.modelPickerIdx - 1)
        this.onUpdate(); return true
      }
      if (e.key === 'arrow_down') {
        this.modelPickerIdx = Math.min(MODEL_OPTIONS.length - 1, this.modelPickerIdx + 1)
        this.onUpdate(); return true
      }
      if (e.key === 'enter') {
        this.selectedModel = MODEL_OPTIONS[this.modelPickerIdx] ?? null
        this.modelPickerOpen = false
        const label = this.selectedModel?.label ?? ''
        this.lines.push({ role: 'system', text: `Model set to ${label}` })
        this.onUpdate(); return true
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
          const found = MODEL_OPTIONS.find(m => m.model === arg || m.label.toLowerCase() === arg.toLowerCase())
          if (found) {
            this.selectedModel = found
            this.lines.push({ role: 'system', text: `Model set to ${found.label}` })
          } else {
            this.lines.push({ role: 'system', text: `Unknown model: "${arg}". Type /model to browse.` })
          }
        } else {
          this.modelPickerOpen = true
          this.modelPickerIdx = Math.max(0, MODEL_OPTIONS.findIndex(m => m.model === this.selectedModel?.model))
          if (this.modelPickerIdx === 0 && this.selectedModel === null) this.modelPickerIdx = 1
        }
        break
      }
      default:
        this.lines.push({ role: 'system', text: `Unknown command: /${name}` })
    }
    this.onUpdate()
  }

  private async runAgentLoop(): Promise<void> {
    this.streaming = true
    await runHook('SessionStart', {})

    const provider = this.selectedModel?.provider ?? defaultProvider()
    const adapter  = createAdapter(provider)
    const loopOpts = this.selectedModel
      ? { adapter, model: this.selectedModel.model, maxTurns: 20 }
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
