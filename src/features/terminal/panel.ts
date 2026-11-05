import * as pty from 'node-pty'
import { Panel } from '@factory/shared/panel.js'
import type { CellBuffer } from '@factory/shared/renderer/cell-buffer.js'
import type { Rect } from '@factory/shared/renderer/layout.js'
import { Colors } from '@factory/shared/renderer/theme.js'
import { VTScreen } from './vt.js'

export class TerminalPanel extends Panel {
  private ptyInstance: pty.IPty | null = null
  private screen: VTScreen
  private scheduleRender: () => void
  private alive = true
  private spawnError: string | null = null

  constructor(rect: Rect, scheduleRender: () => void) {
    super(rect)
    this.scheduleRender = scheduleRender

    const inner = this.inner
    const cols = Math.max(1, inner.width)
    const rows = Math.max(1, inner.height)

    this.screen = new VTScreen(rows, cols)

    // VT-GAP-09: graceful PTY unavailable error
    try {
      this.ptyInstance = pty.spawn(
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

      this.ptyInstance.onData((chunk: string) => {
        if (!this.alive) return
        this.screen.feed(chunk)
        this.scheduleRender()
      })

      this.ptyInstance.onExit(() => {
        this.alive = false
        this.scheduleRender()
      })
    } catch (err) {
      this.alive = false
      this.spawnError = err instanceof Error ? err.message : String(err)
    }
  }

  override render(buf: CellBuffer): void {
    const inner = this.inner

    buf.fill(inner.row, inner.col, inner.height, inner.width, ' ', { bg: Colors.surface })

    if (!this.alive) {
      const msg = this.spawnError
        ? `[PTY unavailable: ${this.spawnError}]`
        : '[terminal exited — press F1–F3 to switch panel]'
      buf.write(inner.row, inner.col, msg.substring(0, inner.width), { fg: Colors.textDim, bg: Colors.surface })
      return
    }

    this.screen.render(buf, inner)

    // Cursor indicator — suppressed when scrolled back (cursor is on live screen, not visible)
    const cr = this.screen.cursorRow
    const cc = this.screen.cursorCol
    if (this.focused && this.screen.isCursorVisible && !this.screen.isScrolledBack
        && cr < inner.height && cc < inner.width) {
      buf.write(inner.row + cr, inner.col + cc, '█', { fg: Colors.primary, bg: Colors.surface })
    }
  }

  /** Forward raw bytes from stdin directly to the PTY. */
  write(data: Buffer): void {
    if (this.alive && this.ptyInstance) this.ptyInstance.write(data.toString('binary'))
  }

  scrollBack(): void  { this.screen.scrollBack() }
  scrollForward(): void { this.screen.scrollForward() }
  get isScrolledBack(): boolean { return this.screen.isScrolledBack }

  resize(rows: number, cols: number): void {
    const r = Math.max(1, rows)
    const c = Math.max(1, cols)
    this.screen.resize(r, c)
    if (this.alive && this.ptyInstance) this.ptyInstance.resize(c, r)
  }

  destroy(): void {
    if (!this.alive) return
    this.alive = false
    try {
      this.ptyInstance?.kill()
    } catch {
      // PTY may already be dead
    }
  }
}
