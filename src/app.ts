import { CellBuffer } from './tui/renderer/cell-buffer.js'
import { computeLayout, drawBorder, type Rect } from './tui/renderer/layout.js'
import { renderStatusBar } from './tui/panels/StatusBar.js'
import { Colors } from './tui/renderer/theme.js'
import * as A from './tui/renderer/ansi.js'
import { parseKey } from './tui/input/keyboard.js'

const TABS = ['Session', 'Orchestration', 'Agents', 'Registry']

export class App {
  private rows = process.stdout.rows ?? 24
  private cols = process.stdout.columns ?? 80
  private buf: CellBuffer
  private prev: CellBuffer
  private activeTab = 0
  private running = false

  constructor() {
    this.buf  = new CellBuffer(this.rows, this.cols)
    this.prev = new CellBuffer(this.rows, this.cols)
  }

  start(): void {
    this.running = true
    this.setup()
    this.render()
    this.listenInput()
  }

  private setup(): void {
    // Enter alternate screen, hide cursor, enable mouse
    process.stdout.write(
      A.enterAltScreen() +
      A.hideCursor() +
      A.enableMouse() +
      A.clearScreen()
    )

    // Handle resize
    process.stdout.on('resize', () => {
      this.rows = process.stdout.rows ?? 24
      this.cols = process.stdout.columns ?? 80
      this.buf  = new CellBuffer(this.rows, this.cols)
      this.prev = new CellBuffer(this.rows, this.cols)
      this.render()
    })

    // Graceful exit
    process.on('SIGINT', () => this.stop())
    process.on('SIGTERM', () => this.stop())
  }

  stop(): void {
    this.running = false
    process.stdout.write(
      A.disableMouse() +
      A.showCursor() +
      A.exitAltScreen()
    )
    process.exit(0)
  }

  private render(): void {
    if (!this.running) return

    const layout = computeLayout(this.rows, this.cols)

    // Fill background
    this.buf.fill(0, 0, this.rows, this.cols, ' ', { bg: Colors.bg })

    // Tab bar
    this.renderTabBar(layout.tabBar.row)

    // Panel borders with placeholder content
    drawBorder(this.buf, layout.session,  'Session',       this.activeTab === 0)
    drawBorder(this.buf, layout.canvas,   'Orchestration', this.activeTab === 1)
    drawBorder(this.buf, layout.agents,   'Agents',        this.activeTab === 2)

    // Placeholder lines
    this.writePlaceholder(layout.session,  'Wave 1 — Claude session coming soon')
    this.writePlaceholder(layout.canvas,   'Wave 2 — ITUI canvas coming soon')
    this.writePlaceholder(layout.agents,   'Wave 2 — Agent list coming soon')

    // Status bar
    renderStatusBar(this.buf, layout.statusBar)

    // Flush diff to stdout
    const diff = this.buf.diff(this.prev)
    if (diff) process.stdout.write(diff)
    this.prev = this.buf.clone()
  }

  private renderTabBar(row: number): void {
    let col = 1
    for (let i = 0; i < TABS.length; i++) {
      const label = ` ${TABS[i]} `
      const active = i === this.activeTab
      this.buf.write(row, col, label, {
        fg: active ? Colors.bg       : Colors.textDim,
        bg: active ? Colors.accent   : Colors.bgPanel,
        bold: active,
      })
      col += label.length + 1
    }
  }

  private writePlaceholder(rect: Rect, text: string): void {
    const inner = {
      row:    rect.row + 1,
      col:    rect.col + 1,
      height: rect.height - 2,
      width:  rect.width - 2,
    }
    const midRow = inner.row + Math.floor(inner.height / 2)
    const padded = text.substring(0, inner.width)
    const offset = Math.floor((inner.width - padded.length) / 2)
    this.buf.write(midRow, inner.col + offset, padded, { fg: Colors.textDim })
  }

  private listenInput(): void {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', (data: Buffer) => {
      const key = parseKey(data)
      if (!key) return

      if (key.key === 'ctrl+q' || key.key === 'q') {
        this.stop()
        return
      }

      if (key.key === 'tab') {
        this.activeTab = (this.activeTab + 1) % TABS.length
        this.render()
      }

      if (key.key >= '1' && key.key <= '4') {
        this.activeTab = parseInt(key.key) - 1
        this.render()
      }
    })
  }
}
