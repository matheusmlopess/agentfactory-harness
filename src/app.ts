import { CellBuffer } from './tui/renderer/cell-buffer.js'
import { computeLayout, drawBorder } from './tui/renderer/layout.js'
import { renderStatusBar } from './tui/panels/StatusBar.js'
import { Colors } from './tui/renderer/theme.js'
import * as A from './tui/renderer/ansi.js'
import { parseKey } from './tui/input/keyboard.js'
import { parseMouse } from './tui/input/mouse.js'
import { InputRouter } from './tui/input/router.js'
import { SessionPanel } from './tui/panels/SessionPanel.js'
import { AgentsPanel } from './tui/panels/AgentsPanel.js'
import { OrchestrationCanvas } from './tui/panels/OrchestrationCanvas.js'
import type { Panel } from './tui/panels/Panel.js'
import { registerTool } from './core/tools/index.js'
import { BashTool } from './core/tools/bash.js'
import { ReadTool } from './core/tools/read.js'
import { WriteTool } from './core/tools/write.js'
import { WebFetchTool } from './core/tools/web-fetch.js'

const TABS = ['Session', 'Orchestration', 'Agents']

export class App {
  private rows = process.stdout.rows ?? 24
  private cols = process.stdout.columns ?? 80
  private buf: CellBuffer
  private prev: CellBuffer
  private activeTab = 0
  private running = false
  private sessionPanel!: SessionPanel
  private canvasPanel!: OrchestrationCanvas
  private agentsPanel!: AgentsPanel
  private panels!: Panel[]
  private router = new InputRouter()

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
    this.canvasPanel  = new OrchestrationCanvas(layout.canvas, () => this.render())
    this.agentsPanel  = new AgentsPanel(layout.agents)
    this.agentsPanel.setAgents([{ name: 'session-0', status: 'idle' }])
    this.panels = [this.sessionPanel, this.canvasPanel, this.agentsPanel]
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
      this.canvasPanel.rect  = layout.canvas
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

    this.canvasPanel.rect    = layout.canvas
    this.canvasPanel.focused = this.activeTab === 1
    this.canvasPanel.render(this.buf)

    this.agentsPanel.rect    = layout.agents
    this.agentsPanel.focused = this.activeTab === 2
    this.agentsPanel.render(this.buf)

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
      // Mouse event — try before keyboard
      const mouse = parseMouse(data)
      if (mouse) {
        this.router.dispatch(mouse, this.panels, this.activeTab)
        return
      }

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

      // F1–F3 switch panels without stealing printable characters
      if (key.key === 'f1') { this.activeTab = 0; this.render(); return }
      if (key.key === 'f2') { this.activeTab = 1; this.render(); return }
      if (key.key === 'f3') { this.activeTab = 2; this.render(); return }

      const consumed = this.router.dispatch(key, this.panels, this.activeTab)
      if (!consumed) this.render()
    })
  }
}
