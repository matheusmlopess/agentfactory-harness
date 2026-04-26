import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { KeyEvent } from '../input/keyboard.js'
import type { Rect } from '../renderer/layout.js'
import { Colors } from '../renderer/theme.js'
import { Session } from '../../core/session.js'
import { agentLoop } from '../../core/agent-loop.js'
import { runHook } from '../../core/hooks.js'

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

  constructor(rect: Rect, onUpdate: () => void) {
    super(rect)
    this.session = new Session()
    this.onUpdate = onUpdate
    this.lines.push({ role: 'system', text: 'factory v0.2.0 — type a message or /help' })
  }

  getSession(): Session {
    return this.session
  }

  render(buf: CellBuffer): void {
    const r = this.inner
    const displayRows = r.height - 1   // last row is input bar
    const inputRow = r.row + r.height - 1

    // Render scrollback
    const wrappedLines = this.wrapLines(r.width)
    const start = Math.max(0, wrappedLines.length - displayRows - this.scrollOffset)
    const visible = wrappedLines.slice(start, start + displayRows)

    for (let i = 0; i < displayRows; i++) {
      const line = visible[i]
      buf.fill(r.row + i, r.col, 1, r.width, ' ', { bg: Colors.bgPanel })
      if (line) {
        const fg = line.role === 'user'
          ? Colors.accent
          : line.role === 'system'
          ? Colors.textDim
          : Colors.text
        buf.write(r.row + i, r.col, line.text.substring(0, r.width), { fg, bg: Colors.bgPanel })
      }
    }

    // Input bar
    buf.fill(inputRow, r.col, 1, r.width, ' ', { bg: Colors.bg })
    const prompt = this.streaming ? '  ' : '> '
    const inputDisplay = (prompt + this.inputBuf).substring(0, r.width - 1)
    buf.write(inputRow, r.col, inputDisplay, { fg: Colors.text, bg: Colors.bg })
  }

  onKey(e: KeyEvent): boolean {
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
      this.scrollOffset = Math.min(this.scrollOffset + 1, Math.max(0, this.lines.length - 1))
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

  private handleSlashCommand(cmd: string): void {
    const parts = cmd.slice(1).split(' ')
    const name = parts[0] ?? ''
    switch (name) {
      case 'help':
        this.lines.push({ role: 'system', text: 'Commands: /help /clear /tokens' })
        break
      case 'clear':
        this.session.clear()
        this.lines = [{ role: 'system', text: 'Session cleared.' }]
        break
      case 'tokens':
        this.lines.push({ role: 'system', text: `Approx tokens: ${this.session.tokenCount()}` })
        break
      default:
        this.lines.push({ role: 'system', text: `Unknown command: /${name}` })
    }
    this.onUpdate()
  }

  private async runAgentLoop(): Promise<void> {
    this.streaming = true
    await runHook('SessionStart', {})

    let currentLine: ChatLine | undefined
    try {
      for await (const event of agentLoop(this.session, { maxTurns: 20 })) {
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
