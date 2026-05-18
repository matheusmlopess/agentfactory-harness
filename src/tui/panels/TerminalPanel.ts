import * as pty from 'node-pty'
import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import { Colors } from '../renderer/theme.js'
import { VTScreen } from '../input/vt.js'

export class TerminalPanel extends Panel {
  private pty: pty.IPty
  private screen: VTScreen
  private scheduleRender: () => void
  private alive = true

  constructor(rect: Rect, scheduleRender: () => void) {
    super(rect)
    this.scheduleRender = scheduleRender

    const inner = this.inner
    const cols = Math.max(1, inner.width)
    const rows = Math.max(1, inner.height)

    this.screen = new VTScreen(rows, cols)

    this.pty = pty.spawn(
      process.env['SHELL'] ?? 'bash',
      [],
      {
        cols,
        rows,
        name: 'xterm-256color',
        cwd: process.cwd(),
        env: process.env as Record<string, string>,
      },
    )

    this.pty.onData((chunk: string) => {
      if (!this.alive) return
      this.screen.feed(chunk)
      this.scheduleRender()
    })

    this.pty.onExit(() => {
      this.alive = false
      this.scheduleRender()
    })
  }

  override render(buf: CellBuffer): void {
    const inner = this.inner

    buf.fill(inner.row, inner.col, inner.height, inner.width, ' ', { bg: Colors.bg })

    if (!this.alive) {
      buf.write(inner.row, inner.col, '[terminal exited — press F1–F3 to switch panel]', {
        fg: Colors.textDim,
        bg: Colors.bg,
      })
      return
    }

    this.screen.render(buf, inner)

    // Cursor indicator: draw a block at the PTY cursor position
    const cr = this.screen.cursorRow
    const cc = this.screen.cursorCol
    if (this.focused && cr < inner.height && cc < inner.width) {
      buf.write(inner.row + cr, inner.col + cc, '█', { fg: Colors.accent, bg: Colors.bg })
    }
  }

  /** Forward raw bytes from stdin directly to the PTY. */
  write(data: Buffer): void {
    if (this.alive) this.pty.write(data.toString('binary'))
  }

  resize(rows: number, cols: number): void {
    if (!this.alive) return
    const r = Math.max(1, rows)
    const c = Math.max(1, cols)
    this.screen.resize(r, c)
    this.pty.resize(c, r)
  }

  destroy(): void {
    if (!this.alive) return
    this.alive = false
    try {
      this.pty.kill()
    } catch {
      // PTY may already be dead
    }
  }
}
