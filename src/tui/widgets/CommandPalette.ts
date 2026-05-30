import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { KeyEvent } from '../input/keyboard.js'
import { Colors } from '../renderer/theme.js'

export interface PaletteCommand {
  id:     string
  label:  string
  hint:   string
  action: () => void
}

/** Score how well `label` matches `query` (case-insensitive).
 *  3 = show-all (empty query)  2 = substring  1 = subsequence  0 = no match */
export function fuzzyScore(label: string, query: string): number {
  if (query === '') return 3
  const lo = label.toLowerCase()
  const q  = query.toLowerCase()
  if (lo.includes(q)) return 2
  let qi = 0
  for (let i = 0; i < lo.length && qi < q.length; i++) {
    if (lo[i] === q[qi]) qi++
  }
  return qi === q.length ? 1 : 0
}

const MAX_VISIBLE = 8
const PALETTE_WIDTH = 64

export class CommandPalette {
  private commands: PaletteCommand[]
  private query   = ''
  private selIdx  = 0
  private open    = false

  constructor(commands: PaletteCommand[]) {
    this.commands = commands
  }

  get isOpen(): boolean { return this.open }

  openPalette(): void {
    this.query  = ''
    this.selIdx = 0
    this.open   = true
  }

  private filtered(): PaletteCommand[] {
    return this.commands.filter(c => fuzzyScore(c.label, this.query) > 0)
  }

  render(buf: CellBuffer, rows: number, cols: number): void {
    if (!this.open) return

    const w      = Math.min(PALETTE_WIDTH, cols - 4)
    const items  = this.filtered()
    const nItems = Math.min(items.length, MAX_VISIBLE)
    // border-top + query + separator + items + border-bottom
    const h      = 3 + Math.max(1, nItems) + 1

    const startRow = Math.max(1, Math.floor(rows * 0.25) - 1)
    const startCol = Math.floor((cols - w) / 2)

    const inner = w - 2  // inside borders

    // ── top border ──────────────────────────────────────────────────────────
    const title    = ' Command Palette '
    const topRight = '─'.repeat(Math.max(0, inner - 2 - title.length))
    buf.write(startRow, startCol,
      '┌─' + title + topRight + '┐',
      { fg: Colors.borderActive })

    // ── query row ───────────────────────────────────────────────────────────
    const promptText = ('  > ' + this.query).padEnd(inner).substring(0, inner)
    buf.write(startRow + 1, startCol, '│', { fg: Colors.borderActive })
    buf.write(startRow + 1, startCol + 1, promptText, { fg: Colors.textBright, bg: Colors.bgPanel })
    buf.write(startRow + 1, startCol + 1 + inner, '│', { fg: Colors.borderActive })

    // ── separator ───────────────────────────────────────────────────────────
    buf.write(startRow + 2, startCol,
      '├' + '─'.repeat(inner) + '┤',
      { fg: Colors.borderActive })

    // ── items ────────────────────────────────────────────────────────────────
    if (items.length === 0) {
      const noMatch = '  (no matches)'.padEnd(inner).substring(0, inner)
      buf.write(startRow + 3, startCol, '│', { fg: Colors.borderActive })
      buf.write(startRow + 3, startCol + 1, noMatch, { fg: Colors.textDim, bg: Colors.bgActive })
      buf.write(startRow + 3, startCol + 1 + inner, '│', { fg: Colors.borderActive })
    } else {
      for (let i = 0; i < nItems; i++) {
        const item     = items[i]!
        const selected = i === this.selIdx
        const fg  = selected ? Colors.bg   : Colors.text
        const bg  = selected ? Colors.accent : Colors.bgActive
        const hfg = selected ? Colors.bg   : Colors.textDim

        const hintPad = item.hint.length > 0 ? '  ' + item.hint : ''
        const labelMax = inner - hintPad.length
        const labelText = (' ' + item.label).padEnd(labelMax).substring(0, labelMax)

        buf.write(startRow + 3 + i, startCol, '│', { fg: Colors.borderActive })
        buf.write(startRow + 3 + i, startCol + 1, labelText, { fg, bg, bold: selected })
        if (hintPad.length > 0) {
          buf.write(startRow + 3 + i, startCol + 1 + labelMax, hintPad, { fg: hfg, bg })
        }
        buf.write(startRow + 3 + i, startCol + 1 + inner, '│', { fg: Colors.borderActive })
      }
    }

    // ── bottom border ────────────────────────────────────────────────────────
    const botRow = startRow + 3 + Math.max(1, nItems)
    buf.write(botRow, startCol,
      '└' + '─'.repeat(inner) + '┘',
      { fg: Colors.borderActive })
  }

  onKey(e: KeyEvent): 'consumed' | 'close' | 'passthrough' {
    if (e.key === 'escape') {
      this.open = false
      return 'close'
    }
    if (e.key === 'enter') {
      const items = this.filtered()
      const item  = items[this.selIdx]
      if (item) item.action()
      this.open = false
      return 'close'
    }
    if (e.key === 'arrow_up') {
      this.selIdx = Math.max(0, this.selIdx - 1)
      return 'consumed'
    }
    if (e.key === 'arrow_down') {
      const max = Math.min(this.filtered().length, MAX_VISIBLE) - 1
      this.selIdx = Math.min(Math.max(0, max), this.selIdx + 1)
      return 'consumed'
    }
    if (e.key === 'backspace') {
      this.query  = this.query.slice(0, -1)
      this.selIdx = 0
      return 'consumed'
    }
    // Printable single character — key IS the char for printable keys
    if (e.key.length === 1 && e.key >= ' ') {
      this.query  += e.key
      this.selIdx  = 0
      return 'consumed'
    }
    return 'passthrough'
  }
}
