import { CellBuffer } from './tui/renderer/cell-buffer.js'
import { computeLayout, drawBorder } from './tui/renderer/layout.js'
import { renderStatusBar } from './tui/panels/StatusBar.js'
import { Colors } from './tui/renderer/theme.js'
import * as A from './tui/renderer/ansi.js'
import { parseKey } from './tui/input/keyboard.js'
import { SessionPanel } from './tui/panels/SessionPanel.js'
import { AgentsPanel } from './tui/panels/AgentsPanel.js'
import { registerTool } from './core/tools/index.js'
import { BashTool } from './core/tools/bash.js'
import { ReadTool } from './core/tools/read.js'
import { WriteTool } from './core/tools/write.js'
import { WebFetchTool } from './core/tools/web-fetch.js'

const TABS = ['Session', 'Orchestration', 'Agents', 'Registry']

export class App {
  private rows = process.stdout.rows ?? 24
  private cols = process.stdout.columns ?? 80
  private buf: CellBuffer
  private prev: CellBuffer
  private activeTab = 0
  private running = false
  private sessionPanel!: SessionPanel
  private agentsPanel!: AgentsPanel

  constructor() {
    this.buf  = new CellBuffer(this.rows, this.cols)
    this.prev = new CellBuffer(this.rows, this.cols)
    this.registerTools()
  }

  private registerTools(): void {
    registerTool(BashTool)
    registerTool(ReadTool)
    registerTool(WriteTool)
    registerTool(WebFetchTool)
  }

  start(): void {
    this.running = true
    this.setup()
    this.initPanels()
    this.render()
    this.listenInput()
  }

  private initPanels(): void {
    const layout = computeLayout(this.rows, this.cols)
    this.sessionPanel = new SessionPanel(layout.session, () => this.render())
    this.agentsPanel  = new AgentsPanel(layout.agents)
    this.agentsPanel.setAgents([{ name: 'session-0', status: 'idle' }])
  }

  private setup(): void {
    process.stdout.write(
      A.enterAltScreen() +
      A.hideCursor() +
      A.enableMouse() +
      A.clearScreen()
    )

    process.stdout.on('resize', () => {
      this.rows = process.stdout.rows ?? 24
      this.cols = process.stdout.columns ?? 80
      this.buf  = new CellBuffer(this.rows, this.cols)
      this.prev = new CellBuffer(this.rows, this.cols)
      const layout = computeLayout(this.rows, this.cols)
      this.sessionPanel.rect = layout.session
      this.agentsPanel.rect  = layout.agents
      this.render()
    })

    process.on('SIGINT',  () => this.stop())
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

    this.buf.fill(0, 0, this.rows, this.cols, ' ', { bg: Colors.bg })
    this.renderTabBar(layout.tabBar.row)

    drawBorder(this.buf, layout.session, 'Session',       this.activeTab === 0)
    drawBorder(this.buf, layout.canvas,  'Orchestration', this.activeTab === 1)
    drawBorder(this.buf, layout.agents,  'Agents',        this.activeTab === 2)

    this.sessionPanel.rect    = layout.session
    this.sessionPanel.focused = this.activeTab === 0
    this.sessionPanel.render(this.buf)

    this.agentsPanel.rect    = layout.agents
    this.agentsPanel.focused = this.activeTab === 2
    this.agentsPanel.render(this.buf)

    // Canvas placeholder (Wave 2)
    const cv = layout.canvas
    const midRow = cv.row + Math.floor(cv.height / 2)
    const msg = 'Wave 2 — ITUI canvas coming soon'
    this.buf.write(
      midRow,
      cv.col + 1 + Math.floor((cv.width - 2 - msg.length) / 2),
      msg,
      { fg: Colors.textDim }
    )

    renderStatusBar(this.buf, layout.statusBar)

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
        fg: active ? Colors.bg      : Colors.textDim,
        bg: active ? Colors.accent  : Colors.bgPanel,
        bold: active,
      })
      col += label.length + 1
    }
  }

  private listenInput(): void {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', (data: Buffer) => {
      const key = parseKey(data)
      if (!key) return

      if (key.key === 'ctrl+q' || key.key === 'ctrl+c') {
        this.stop()
        return
      }

      if (key.key === 'tab') {
        this.activeTab = (this.activeTab + 1) % TABS.length
        this.render()
        return
      }

      if (key.key >= '1' && key.key <= '4') {
        this.activeTab = parseInt(key.key) - 1
        this.render()
        return
      }

      // Dispatch to active panel
      if (this.activeTab === 0) {
        if (this.sessionPanel.onKey(key)) return
      }
    })
  }
}
