import { readFile, appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
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
import { TerminalPanel } from './tui/panels/TerminalPanel.js'
import type { Panel } from './tui/panels/Panel.js'
import { registerTool } from './core/tools/index.js'
import { BashTool } from './core/tools/bash.js'
import { ReadTool } from './core/tools/read.js'
import { WriteTool } from './core/tools/write.js'
import { WebFetchTool } from './core/tools/web-fetch.js'
import { PlanSchema, type Plan } from './orchestration/schema.js'
import { Executor } from './orchestration/executor.js'
import { Session } from './core/session.js'
import { agentLoop } from './core/agent-loop.js'
import { createAdapter, defaultProvider } from './core/llm/index.js'
import { ConfigPanel } from './tui/panels/ConfigPanel.js'
import { LogsPanel } from './tui/panels/LogsPanel.js'
import { store } from './core/config/store.js'
import { CommandPalette } from './tui/widgets/CommandPalette.js'
import { getUser, clearToken } from './registry/auth.js'
import { startDeviceLogin } from './registry/login.js'
import { importFromTools } from './registry/import-keys.js'
import { logger, getLogFilePath, type LogEntry } from './core/logger.js'

const log = logger('App')

const TABS = ['Session', 'Orchestration', 'Agents', 'Terminal', 'Config', 'Logs']
const TAB_TERMINAL = 3
const TAB_CONFIG   = 4
const TAB_LOGS     = 5
const EXIT_BTN = ' ✕ Quit '

export class App {
  private rows = process.stdout.rows ?? 24
  private cols = process.stdout.columns ?? 80
  private buf: CellBuffer
  private prev: CellBuffer
  private activeTab = 0
  private running = false
  private renderPending = false
  private currentPlan: Plan | null = null
  private planRunning = false
  private statusError: string | null = null
  private statusErrorTimer: ReturnType<typeof setTimeout> | null = null
  private logsLastAnalyzedAt = 0
  private logsHeartbeatInterval: ReturnType<typeof setInterval> | null = null
  private logsCountdownInterval: ReturnType<typeof setInterval> | null = null
  private sessionPanel!: SessionPanel
  private canvasPanel!: OrchestrationCanvas
  private agentsPanel!: AgentsPanel
  private terminalPanel: TerminalPanel | null = null
  private configPanel: ConfigPanel | null = null
  private logsPanel!: LogsPanel
  private palette!: CommandPalette
  private paletteOpen = false
  private statusBarModelTagCol = -1
  private statusBarModelTagLen = 0
  private statusBarToolToggleCol = -1
  private statusBarToolToggleLen = 0
  private panels!: Panel[]
  private router = new InputRouter()
  private mouseEnabled = true   // toggled off (Ctrl+E) to allow native text selection/copy

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

  async start(): Promise<void> {
    log.info('startup', { version: '0.6.0', cols: this.cols, rows: this.rows })
    this.running = true
    this.setup()
    await store.init()
    log.debug('config store initialized')
    this.initPanels()
    log.debug('panels initialized')
    await this.tryLoadPlan()
    log.debug('plan loaded', { currentPlan: this.currentPlan ? 'yes' : 'no' })
    // Load registry auth user in background — don't block startup
    void getUser().then(user => {
      log.debug('auth user loaded', { isLoggedIn: user !== null })
      this.configPanel?.setAuthUser(user)
    })
    this.render()
    log.info('render started')
    this.listenInput()
    log.info('input listener started', { logFile: getLogFilePath() })
    this.startLogsHeartbeat()
  }

  private scheduleRender(): void {
    if (this.renderPending) return
    this.renderPending = true
    setImmediate(() => {
      this.renderPending = false
      this.render()
    })
  }

  private initPanels(): void {
    const layout = computeLayout(this.rows, this.cols)
    this.sessionPanel = new SessionPanel(layout.session, () => this.scheduleRender(),
      () => { this.scheduleRender() },                                  // onStats: records hold state; just repaint
      (target) => { if (target === 'config') { this.activeTab = TAB_CONFIG; this.render() } },
      (text) => { process.stdout.write(A.osc52Copy(text)) },           // onCopy via OSC 52
    )
    this.canvasPanel  = new OrchestrationCanvas(layout.canvas, () => this.scheduleRender())
    this.agentsPanel  = new AgentsPanel(layout.agents, () => this.scheduleRender(),
      (idx) => { this.sessionPanel.switchTo(idx); this.render() },     // click a session → switch active
    )
    this.configPanel = new ConfigPanel(layout.config, () => this.scheduleRender(), {
      onLogin:  () => { void this.runLoginFlow() },
      onLogout: () => { void this.runLogout()    },
      onImport: () => { void this.runImport()    },
    })
    this.logsPanel = new LogsPanel(
      layout.session,
      () => this.scheduleRender(),
      (entries) => { void this.runLogsAnalysis(entries) },  // onAnalyze callback
    )
    // ConfigPanel (TAB_CONFIG=4) and LogsPanel (TAB_LOGS=5) are dispatched explicitly
    // Keep them out of panels[] so router.dispatch() doesn't try to handle them
    this.panels = [this.sessionPanel, this.canvasPanel, this.agentsPanel]

    this.palette = new CommandPalette([
      { id: 'switch-session',       label: 'Switch to Session',       hint: 'F1',     action: () => { this.activeTab = 0;           this.render() } },
      { id: 'switch-orchestration', label: 'Switch to Orchestration', hint: 'F2',     action: () => { this.activeTab = 1;           this.render() } },
      { id: 'switch-agents',        label: 'Switch to Agents',        hint: 'F3',     action: () => { this.activeTab = 2;           this.render() } },
      { id: 'switch-terminal',      label: 'Switch to Terminal',      hint: 'F4',     action: () => { this.activeTab = TAB_TERMINAL; this.render() } },
      { id: 'switch-config',        label: 'Switch to Config',        hint: 'F5',     action: () => { this.activeTab = TAB_CONFIG;   this.render() } },
      { id: 'switch-logs',          label: 'Switch to Logs',          hint: 'F6',     action: () => { this.activeTab = TAB_LOGS;     this.render() } },
      { id: 'login',                label: 'Login to AgentFactory',   hint: '',       action: () => { this.activeTab = TAB_CONFIG; void this.runLoginFlow() } },
      { id: 'logout',               label: 'Logout from AgentFactory',hint: '',       action: () => { void this.runLogout() } },
      { id: 'run-plan',             label: 'Run Plan',                hint: 'Ctrl+R', action: () => { void this.runPlan() } },
      { id: 'clear-session',        label: 'Clear Session',           hint: '',       action: () => { this.sessionPanel.clearSession(); this.render() } },
      { id: 'quit',                 label: 'Quit',                    hint: 'Ctrl+Q', action: () => { this.stop() } },
    ])
  }

  // VT-GAP-08: lazy PTY spawn — only on first switch to Terminal tab
  private ensureTerminalPanel(): TerminalPanel {
    if (!this.terminalPanel) {
      const layout = computeLayout(this.rows, this.cols)
      this.terminalPanel = new TerminalPanel(layout.terminal, () => this.scheduleRender())
    }
    return this.terminalPanel
  }

  private async tryLoadPlan(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(resolve(process.cwd(), 'af-plan.json'), 'utf8'))
      const plan = PlanSchema.parse(raw)
      this.currentPlan = plan
      this.canvasPanel.syncFromPlan(plan)
    } catch (err) {
      const isNoFile = err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
      if (!isNoFile) {
        this.showError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  private showError(msg: string): void {
    this.statusError = msg.substring(0, 120)
    if (this.statusErrorTimer) clearTimeout(this.statusErrorTimer)
    this.statusErrorTimer = setTimeout(() => {
      this.statusError = null
      this.statusErrorTimer = null
      this.scheduleRender()
    }, 5000)
    this.scheduleRender()
  }

  private startLogsHeartbeat(): void {
    // Start 2-minute heartbeat
    this.logsHeartbeatInterval = setInterval(() => {
      void this.runLogsAnalysis(true)  // true = auto
    }, 2 * 60 * 1000)

    // Start countdown ticker (updates every second)
    let countdown = 120
    this.logsCountdownInterval = setInterval(() => {
      countdown = Math.max(0, countdown - 1)
      this.logsPanel.setCountdown(countdown)
      if (countdown === 0) countdown = 120
      this.scheduleRender()
    }, 1000)
  }

  private stopLogsHeartbeat(): void {
    if (this.logsHeartbeatInterval) {
      clearInterval(this.logsHeartbeatInterval)
      this.logsHeartbeatInterval = null
    }
    if (this.logsCountdownInterval) {
      clearInterval(this.logsCountdownInterval)
      this.logsCountdownInterval = null
    }
  }

  private async runLoginFlow(): Promise<void> {
    if (!this.configPanel) return
    this.activeTab = TAB_CONFIG
    this.render()
    for await (const ev of startDeviceLogin()) {
      this.configPanel.updateLoginEvent(ev)
      this.render()
      if (ev.kind === 'success' || ev.kind === 'error') break
    }
  }

  private async runLogout(): Promise<void> {
    await clearToken()
    this.configPanel?.setAuthUser(null)
    this.render()
  }

  private async runImport(): Promise<void> {
    if (!this.configPanel) return
    const candidates = await importFromTools()
    this.configPanel.showImportCandidates(candidates)
    this.render()
  }

  private async runPlan(): Promise<void> {
    if (!this.currentPlan || this.planRunning) return
    this.planRunning = true

    try {
      const plan = this.currentPlan
      this.canvasPanel.syncFromPlan(plan)

      const executor = new Executor(plan, {
        agentRunner: async (step) => {
          const provider = step.provider ?? defaultProvider()
          const adapter = createAdapter(provider)
          const session = new Session()
          session.addMessage({ role: 'user', content: step.prompt })
          let out = ''
          for await (const e of agentLoop(session, {
            adapter,
            ...(step.model !== undefined ? { model: step.model } : {}),
          })) {
            if (e.type === 'text_delta') out += e.delta
          }
          return out.trim()
        },
      })

      for await (const event of executor.run()) {
        this.canvasPanel.applyStepEvent(event)
      }
    } finally {
      this.planRunning = false
    }
  }

  private async runLogsAnalysis(auto = false): Promise<void> {
    if (this.logsPanel.isInsightsStreaming) return

    const allEntries = getRecentLogs()
    const since = auto ? this.logsLastAnalyzedAt : 0
    const entries = since > 0 ? allEntries.filter(e => new Date(e.timestamp).getTime() > since) : allEntries

    if (auto && entries.length < 3) return

    const startedAt = Date.now()
    this.logsPanel.startInsights(auto)
    this.scheduleRender()

    const sample = entries.slice(-50)
    const lines = sample
      .map(
        (e) =>
          `[${e.timestamp.slice(11, 19)}] ${e.level.padEnd(5)} ${e.source.padEnd(15)} ${e.message}` +
          (e.meta ? ' ' + JSON.stringify(e.meta) : ''),
      )
      .join('\n')

    const prompt =
      `You are analyzing application logs from agentfactory-harness, an AI agent terminal. ` +
      `Summarize what happened, highlight any warnings or errors, and suggest anything unusual.\n\n` +
      `Log entries (most recent last):\n${lines}`

    const session = new Session()
    session.addMessage({ role: 'user', content: prompt })
    const adapter = createAdapter(defaultProvider())

    try {
      for await (const e of agentLoop(session, { adapter })) {
        if (e.type === 'text_delta') {
          this.logsPanel.appendInsights(e.delta)
          this.scheduleRender()
        }
      }
    } finally {
      this.logsLastAnalyzedAt = startedAt
      this.logsPanel.finishInsights()
      this.scheduleRender()
    }
  }

  private setup(): void {
    process.stdout.write(
      A.enterAltScreen() +
      A.hideCursor() +
      A.enableMouse() +
      A.enableBracketedPaste() +
      A.clearScreen()
    )

    process.stdout.on('resize', () => {
      this.rows = process.stdout.rows ?? 24
      this.cols = process.stdout.columns ?? 80
      this.buf  = new CellBuffer(this.rows, this.cols)
      this.prev = new CellBuffer(this.rows, this.cols)
      const layout = computeLayout(this.rows, this.cols)
      this.sessionPanel.rect  = layout.session
      this.canvasPanel.rect   = layout.canvas
      this.agentsPanel.rect   = layout.agents
      if (this.terminalPanel) {
        this.terminalPanel.rect = layout.terminal
        const inner = this.terminalPanel.inner
        this.terminalPanel.resize(inner.height, inner.width)
      }
      if (this.configPanel) this.configPanel.rect = layout.config
      this.render()
    })

    process.on('SIGINT',  () => this.stop())
    process.on('SIGTERM', () => this.stop())

    // Log uncaught errors to /tmp/factory-err.log so they survive the alt-screen
    const logErr = (err: unknown): void => {
      const msg = `[${new Date().toISOString()}] ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`
      void appendFile('/tmp/factory-err.log', msg)
    }
    process.on('uncaughtException', (err) => { logErr(err); this.stop() })
    process.on('unhandledRejection', (reason) => { logErr(reason) })

    // Last-resort cleanup: runs on normal exit and on uncaught exceptions,
    // but NOT on SIGKILL. Ensures mouse tracking and alt-screen are always
    // disabled even if stop() was never called.
    process.on('exit', () => {
      process.stdout.write(A.disableMouse() + A.disableBracketedPaste() + A.showCursor() + A.exitAltScreen())
    })
  }

  /** Push the SessionPanel's session list into the Agents panel (switcher + stats). */
  private refreshAgents(): void {
    const metas = this.sessionPanel.sessionMetas()
    this.agentsPanel.setAgents(metas.map(m => ({
      name:         m.name,
      status:       m.status,
      active:       m.active,
      ...(m.stats ? {
        model:        m.stats.model,
        inputTokens:  m.stats.inputTokens,
        outputTokens: m.stats.outputTokens,
        toolCalls:    m.stats.toolCalls,
        turns:        m.stats.turns,
        startTime:    m.stats.startTime,
        ...(m.status !== 'running' ? { endTime: Date.now() } : {}),
      } : {}),
    })))
  }

  /** Toggle mouse reporting. When off, the terminal handles native text
   *  selection so the user can copy output; when on, the TUI gets clicks. */
  private toggleMouseCapture(): void {
    this.mouseEnabled = !this.mouseEnabled
    process.stdout.write(this.mouseEnabled ? A.enableMouse() : A.disableMouse())
    this.render()
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    this.stopLogsHeartbeat()
    this.terminalPanel?.destroy()
    // Drain stdin before exit so buffered mouse events don't leak into the shell
    process.stdin.removeAllListeners('data')
    process.stdin.setRawMode(false)
    process.stdin.pause()
    // Write cleanup sequences and exit only after they are flushed to the terminal
    process.stdout.write(
      A.disableMouse() + A.disableBracketedPaste() + A.showCursor() + A.exitAltScreen(),
      () => process.exit(0),
    )
  }

  private render(): void {
    if (!this.running) return

    const layout = computeLayout(this.rows, this.cols)
    const onTerminal = this.activeTab === TAB_TERMINAL

    this.buf.fill(0, 0, this.rows, this.cols, ' ', { bg: Colors.bg })
    this.renderTabBar(layout.tabBar.row)

    // Left column — always visible
    drawBorder(this.buf, layout.session, 'Session', this.activeTab === 0)
    this.sessionPanel.rect    = layout.session
    this.sessionPanel.focused = this.activeTab === 0
    this.sessionPanel.render(this.buf)

    if (this.activeTab === TAB_CONFIG) {
      drawBorder(this.buf, layout.config, 'Config', true)
      this.configPanel!.rect    = layout.config
      this.configPanel!.focused = true
      this.configPanel!.render(this.buf)
    } else if (this.activeTab === TAB_LOGS) {
      const logsRect = {
        row:    layout.session.row,
        col:    0,
        height: layout.session.height,
        width:  this.cols,
      }
      drawBorder(this.buf, logsRect, 'Logs', true)
      this.logsPanel.rect    = logsRect
      this.logsPanel.focused = true
      this.logsPanel.render(this.buf)
    } else if (onTerminal) {
      const tp = this.ensureTerminalPanel()
      drawBorder(this.buf, layout.terminal, 'Terminal', true)
      tp.rect    = layout.terminal
      tp.focused = true
      tp.render(this.buf)
    } else {
      drawBorder(this.buf, layout.canvas, 'Orchestration', this.activeTab === 1)
      drawBorder(this.buf, layout.agents, 'Agents',        this.activeTab === 2)

      this.canvasPanel.rect    = layout.canvas
      this.canvasPanel.focused = this.activeTab === 1
      this.canvasPanel.render(this.buf)

      this.refreshAgents()
      this.agentsPanel.rect    = layout.agents
      this.agentsPanel.focused = this.activeTab === 2
      this.agentsPanel.render(this.buf)
    }

    // Always show a model tag — selected ID or "select model" as a click prompt
    const modelLabel = this.sessionPanel.getSelectedModel()?.id ?? 'select model'
    const mode = this.planRunning ? 'running' : this.mouseEnabled ? 'NORMAL' : 'SELECT'
    const sbLayout = renderStatusBar(
      this.buf, layout.statusBar,
      mode,
      this.statusError ?? undefined,
      modelLabel,
      this.sessionPanel.getChatMode(),
    )
    this.statusBarModelTagCol = sbLayout.modelTagCol
    this.statusBarModelTagLen = sbLayout.modelTagLen
    this.statusBarToolToggleCol = sbLayout.toolToggleCol
    this.statusBarToolToggleLen = sbLayout.toolToggleLen

    if (this.paletteOpen) this.palette.render(this.buf, this.rows, this.cols)

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
    // Exit button — right-aligned in the tab bar
    const exitCol = this.cols - EXIT_BTN.length - 1
    this.buf.write(row, exitCol, EXIT_BTN, { fg: Colors.bg, bg: 196, bold: true })
  }

  /** True if a click at (row=0, col) lands on the exit button. */
  private isExitBtn(col: number): boolean {
    const exitCol = this.cols - EXIT_BTN.length - 1
    return col >= exitCol && col < exitCol + EXIT_BTN.length
  }

  /** Returns tab index (0-based) for a click on the tab bar row, or -1. */
  private tabAt(col: number): number {
    let c = 1
    for (let i = 0; i < TABS.length; i++) {
      const label = ` ${TABS[i]!} `
      if (col >= c && col < c + label.length) return i
      c += label.length + 1
    }
    return -1
  }

  /** Returns the tab index that a click at (row, col) should focus, or -1. */
  private panelTabAt(row: number, col: number): number {
    const layout = computeLayout(this.rows, this.cols)
    const s = layout.session
    if (row >= s.row && row < s.row + s.height && col >= s.col && col < s.col + s.width) return 0
    if (this.activeTab === TAB_CONFIG) {
      const cfg = layout.config
      if (row >= cfg.row && row < cfg.row + cfg.height && col >= cfg.col && col < cfg.col + cfg.width) return TAB_CONFIG
    } else if (this.activeTab === TAB_TERMINAL) {
      const t = layout.terminal
      if (row >= t.row && row < t.row + t.height && col >= t.col && col < t.col + t.width) return TAB_TERMINAL
    } else {
      const cv = layout.canvas
      if (row >= cv.row && row < cv.row + cv.height && col >= cv.col && col < cv.col + cv.width) return 1
      const ag = layout.agents
      if (row >= ag.row && row < ag.row + ag.height && col >= ag.col && col < ag.col + ag.width) return 2
    }
    return -1
  }

  private listenInput(): void {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', (data: Buffer) => {
      // When Terminal tab is active, bypass parseKey and forward raw bytes
      // to the PTY. Only intercept Ctrl+Q and F1–F4 via raw byte patterns.
      if (this.activeTab === TAB_TERMINAL) {
        if (data[0] === 0x11) { this.stop(); return }                  // Ctrl+Q
        if (data[0] === 0x10) { this.paletteOpen = !this.paletteOpen; if (this.paletteOpen) this.palette.openPalette(); this.render(); return } // Ctrl+P

        // When palette is open in terminal mode, route input to palette — never to PTY
        if (this.paletteOpen) {
          const key = parseKey(data)
          if (key) {
            this.palette.onKey(key)
            if (!this.palette.isOpen) this.paletteOpen = false
          }
          this.render()
          return
        }

        // VT-GAP-04: match both xterm (\x1bOP) and VT100 (\x1b[11~) F-key forms
        const s = data.toString('binary')
        if (s === '\x1bOP' || s === '\x1b[11~') { this.activeTab = 0;           this.render(); return } // F1
        if (s === '\x1bOQ' || s === '\x1b[12~') { this.activeTab = 1;           this.render(); return } // F2
        if (s === '\x1bOR' || s === '\x1b[13~') { this.activeTab = 2;           this.render(); return } // F3
        if (s === '\x1bOS' || s === '\x1b[14~') return                                                  // F4 — already on Terminal, no-op
        if (s === '\x1b[15~')                   { this.activeTab = TAB_CONFIG;  this.render(); return } // F5 → Config

        // Shift+PgUp / Shift+PgDn — scroll terminal scrollback
        if (s === '\x1b[5;2~') { this.ensureTerminalPanel().scrollBack();   this.render(); return }
        if (s === '\x1b[6;2~') { this.ensureTerminalPanel().scrollForward(); this.render(); return }

        // SGR mouse events: intercept tab bar clicks, suppress the rest from reaching PTY
        if (s.startsWith('\x1b[<')) {
          const mouse = parseMouse(data)
          if (mouse) {
            if (this.paletteOpen) {
              this.palette.onMouse(mouse, this.rows, this.cols)
              if (!this.palette.isOpen) this.paletteOpen = false
              this.render()
              return
            }
            if (mouse.button === 'left' && mouse.action === 'press' && mouse.row === 0) {
              if (this.isExitBtn(mouse.col)) { this.stop(); return }
              const tab = this.tabAt(mouse.col)
              if (tab >= 0) { this.activeTab = tab; this.render() }
            }
          }
          return
        }

        this.ensureTerminalPanel().write(data)
        return
      }

      // Mouse event — try before keyboard (non-terminal tabs only)
      const mouse = parseMouse(data)
      if (mouse) {
        // Shift+click: pass through to terminal for native text selection
        if (mouse.shift) return

        // Palette overlay intercepts ALL mouse when open — nothing behind it is clickable
        if (this.paletteOpen) {
          this.palette.onMouse(mouse, this.rows, this.cols)
          if (!this.palette.isOpen) this.paletteOpen = false
          this.render()
          return
        }
        if (mouse.button === 'left' && mouse.action === 'press') {
          // Tab bar click
          if (mouse.row === 0) {
            if (this.isExitBtn(mouse.col)) { this.stop(); return }
            const tab = this.tabAt(mouse.col)
            if (tab >= 0) {
              // Clicking the Session tab while already on it opens the New Session menu
              if (tab === 0 && this.activeTab === 0) { this.sessionPanel.openNewSessionMenu() }
              this.activeTab = tab; this.render(); return
            }
          }
          // Status bar model tag click → open model picker in session panel
          if (mouse.row === this.rows - 1 &&
              this.statusBarModelTagCol >= 0 &&
              mouse.col >= this.statusBarModelTagCol &&
              mouse.col < this.statusBarModelTagCol + this.statusBarModelTagLen) {
            this.activeTab = 0  // switch to Session tab
            this.sessionPanel.openModelPicker()
            this.render()
            return
          }
          // Status bar tool toggle click → toggle chat mode
          if (mouse.row === this.rows - 1 &&
              this.statusBarToolToggleCol >= 0 &&
              mouse.col >= this.statusBarToolToggleCol &&
              mouse.col < this.statusBarToolToggleCol + this.statusBarToolToggleLen) {
            this.sessionPanel.toggleChatMode()
            this.render()
            return
          }
          // Panel body click — focus the panel under the cursor
          const clickedTab = this.panelTabAt(mouse.row, mouse.col)
          if (clickedTab >= 0 && clickedTab !== this.activeTab) {
            this.activeTab = clickedTab
          }
        }
        // Config panel owns the right column when active — dispatch directly so it
        // is not shadowed by canvasPanel/agentsPanel which share the same rect slot.
        // Always render after — scroll/click both mutate state that needs immediate repaint.
        if (this.activeTab === TAB_CONFIG) {
          this.configPanel!.onMouse(mouse)
          this.render()
          return
        }
        // Logs panel is left column — dispatch directly (same rect as session)
        if (this.activeTab === TAB_LOGS) {
          const layout = computeLayout(this.rows, this.cols)
          const logsRect = {
            row: layout.session.row,
            col: 0,
            height: layout.session.height,
            width: this.cols,
          }
          this.logsPanel.rect = logsRect  // set rect BEFORE onMouse dispatch
          this.logsPanel.onMouse(mouse)
          this.render()
          return
        }
        // Only repaint when the panel actually consumed the event — avoids a
        // full render on every passive-motion (mode 1003) event.
        if (this.router.dispatch(mouse, this.panels, this.activeTab)) this.render()
        return
      }

      const key = parseKey(data)
      if (!key) {
        // Bracketed paste or raw multi-char paste — strip markers, dispatch each printable char
        let str = data.toString('utf8')
        str = str.replace(/^\x1b\[200~/, '').replace(/\x1b\[201~$/, '')
        if (str.length > 0 && !str.startsWith('\x1b')) {
          for (const ch of str) {
            if (ch >= ' ' && ch !== '\x7f') {
              const fakeKey = { key: ch, raw: Buffer.from(ch) }
              if (this.paletteOpen) {
                this.palette.onKey(fakeKey)
                if (!this.palette.isOpen) this.paletteOpen = false
              } else if (this.activeTab === TAB_CONFIG) {
                this.configPanel!.onKey(fakeKey)
              } else {
                this.router.dispatch(fakeKey, this.panels, this.activeTab)
              }
            }
          }
          this.render()
        }
        return
      }

      if (key.key === 'ctrl+q') {
        this.stop()
        return
      }

      // Ctrl+C — copy session selection if one exists; otherwise quit
      if (key.key === 'ctrl+c') {
        if (this.activeTab === 0 && this.sessionPanel.hasSelection()) {
          this.sessionPanel.copySelection()
          this.sessionPanel.clearSelection()
          this.render()
          return
        }
        this.stop()
        return
      }

      // Ctrl+E — toggle mouse capture so native terminal text selection/copy works
      if (key.key === 'ctrl+e') {
        this.toggleMouseCapture()
        return
      }

      // Ctrl+P — toggle palette (works from any non-terminal tab)
      if (key.key === 'ctrl+p') {
        this.paletteOpen = !this.paletteOpen
        if (this.paletteOpen) this.palette.openPalette()
        this.render()
        return
      }

      // Route all keys to palette when open
      if (this.paletteOpen) {
        this.palette.onKey(key)
        if (!this.palette.isOpen) this.paletteOpen = false
        this.render()
        return
      }

      if (key.key === 'tab') {
        this.activeTab = (this.activeTab + 1) % TABS.length
        this.render()
        return
      }

      // F1–F6 switch panels without stealing printable characters
      if (key.key === 'f1') { if (this.activeTab === 0) this.sessionPanel.openNewSessionMenu(); this.activeTab = 0; this.render(); return }
      if (key.key === 'f2') { this.activeTab = 1;           this.render(); return }
      if (key.key === 'f3') { this.activeTab = 2;           this.render(); return }
      if (key.key === 'f4') { this.activeTab = TAB_TERMINAL; this.render(); return }
      if (key.key === 'f5') { this.activeTab = TAB_CONFIG;   this.render(); return }
      if (key.key === 'f6') { this.activeTab = TAB_LOGS;     this.render(); return }

      // Config panel: dispatch keys directly (TAB_CONFIG=4 doesn't match panels[] index)
      if (this.activeTab === TAB_CONFIG) {
        const consumed = this.configPanel!.onKey(key)
        if (!consumed) this.render()
        return
      }

      // Logs panel: dispatch keys directly (TAB_LOGS=5 doesn't match panels[] index)
      if (this.activeTab === TAB_LOGS) {
        const layout = computeLayout(this.rows, this.cols)
        const logsRect = {
          row: layout.session.row,
          col: 0,
          height: layout.session.height,
          width: this.cols,
        }
        this.logsPanel.rect = logsRect  // set rect BEFORE onKey dispatch
        const consumed = this.logsPanel.onKey(key)
        if (!consumed) this.render()
        return
      }

      // Ctrl+R — run the loaded plan (no-op if no plan or already running)
      if (key.key === 'ctrl+r') {
        void this.runPlan()
        return
      }

      const consumed = this.router.dispatch(key, this.panels, this.activeTab)
      if (!consumed) this.render()
    })
  }
}
