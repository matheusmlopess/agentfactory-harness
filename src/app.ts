import { readFile, appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { CellBuffer } from './tui/renderer/cell-buffer.js'
import { computeLayout, drawBorder } from './tui/renderer/layout.js'
import { renderStatusBar } from './tui/panels/StatusBar.js'
import { Colors, setTheme } from './tui/renderer/theme.js'
import { refreshMotionSetting } from './tui/renderer/motion.js'
import { activeProfile, sizeCheck, renderTooSmall } from './tui/renderer/size-profiles.js'
import type { LayoutPrefs } from './tui/renderer/layout.js'
import * as A from './tui/renderer/ansi.js'
import { InputRouter } from './tui/input/router.js'
import { InputController, type ControllerHost } from './tui/input/controller.js'
import { HitMap } from './tui/input/hit-test.js'
import { Keymap, type KeyBindingDef } from './tui/input/keymap.js'
import { HelpOverlay } from './tui/widgets/HelpOverlay.js'
import { type TabEntry, type TabId, tabIndex, tabIdAt } from './tui/tabs.js'
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
import { store } from './core/config/store.js'
import { CommandPalette } from './tui/widgets/CommandPalette.js'
import { getUser, clearToken } from './registry/auth.js'
import { startDeviceLogin } from './registry/login.js'
import { importFromTools } from './registry/import-keys.js'
import { logger, getLogFilePath } from './core/logger.js'
import { tabLabelSpans, EXIT_BTN } from './tui/tab-bar.js'
import { getVersion } from './core/version.js'
import { registerFeature, loadedFeatures, resetFeatures } from './features/registry.js'
import type { FeatureCtx } from './features/types.js'
import { logsFeature } from './features/logs/index.js'

const log = logger('App')

const TAB_TITLES: Record<TabId, string> = {
  session: 'Session', orchestration: 'Orchestration', agents: 'Agents',
  terminal: 'Terminal', config: 'Config', logs: 'Logs',
}

export class App {
  private rows = process.stdout.rows ?? 24
  private cols = process.stdout.columns ?? 80
  private buf: CellBuffer
  private prev: CellBuffer
  private activeTab: TabId = 'session'
  private running = false
  private renderPending = false
  private currentPlan: Plan | null = null
  private planRunning = false
  private statusError: string | null = null
  private statusErrorTimer: ReturnType<typeof setTimeout> | null = null
  private sessionPanel!: SessionPanel
  private canvasPanel!: OrchestrationCanvas
  private agentsPanel!: AgentsPanel
  private terminalPanel: TerminalPanel | null = null
  private configPanel: ConfigPanel | null = null
  private logsPanel!: Panel
  private palette!: CommandPalette
  private paletteOpen = false
  private tabs!: TabEntry[]
  private readonly services = new Map<string, unknown>()
  private readonly hitMap = new HitMap()
  private readonly keymap = new Keymap()
  private help!: HelpOverlay
  private layoutPrefs: LayoutPrefs = {}
  private router = new InputRouter()
  private controller!: InputController
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
    log.info('startup', { version: getVersion(), cols: this.cols, rows: this.rows })
    this.running = true
    this.setup()
    await store.init()
    setTheme(store.getSetting('theme') === 'high-contrast' ? 'high-contrast' : 'default')
    const sessionRatio = Number(store.getSetting('layout.sessionRatio'))
    const canvasRatio = Number(store.getSetting('layout.canvasRatio'))
    if (Number.isFinite(sessionRatio) && sessionRatio > 0) this.layoutPrefs.sessionRatio = sessionRatio
    if (Number.isFinite(canvasRatio) && canvasRatio > 0) this.layoutPrefs.canvasRatio = canvasRatio
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
    this.controller.attach(process.stdin)
    log.info('input listener started', { logFile: getLogFilePath() })
    for (const f of loadedFeatures()) f.start?.(this.featureCtx())
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
    const layout = this.layout()
    this.sessionPanel = new SessionPanel(layout.session, () => this.scheduleRender(),
      () => { this.scheduleRender() },                                  // onStats: records hold state; just repaint
      (target) => { if (target === 'config') { this.activeTab = 'config'; this.render() } },
      (text) => { process.stdout.write(A.osc52Copy(text)) },           // onCopy via OSC 52
    )
    this.canvasPanel  = new OrchestrationCanvas(layout.canvas, () => this.scheduleRender())
    this.agentsPanel  = new AgentsPanel(layout.agents, () => this.scheduleRender(),
      (idx) => { this.sessionPanel.switchTo(idx); this.render() },     // click a session → switch active
    )
    this.configPanel = new ConfigPanel(layout.config, () => this.scheduleRender(), {
      onLogin:   () => { void this.runLoginFlow() },
      onLogout:  () => { void this.runLogout()    },
      onImport:  () => { void this.runImport()    },
      onSetting: (key, value) => this.applySetting(key, value),
    })

    // Feature registry seed: Logs is loaded generically; the other five tabs
    // stay legacy until Phase 5 migrates them (ddd/11 incremental path).
    resetFeatures()
    registerFeature(logsFeature())
    const ctx = this.featureCtx()
    const featureTabs: TabEntry[] = loadedFeatures().flatMap(f => {
      const tab = f.tab
      if (!tab) return []
      const panel = tab.makePanel(ctx)
      if (tab.id === 'logs') this.logsPanel = panel
      return [{
        id: tab.id,
        title: tab.title,
        captureMouse: tab.captureMouse,
        panel: () => panel,
        rectFor: tab.rectFor,
        hitVisible: tab.hitVisible,
      }]
    })

    // The unified tab list — all six tabs are first-class routing targets.
    // hitVisible reproduces the historical panelTabAt click-to-focus branches.
    this.tabs = [
      { id: 'session',       title: TAB_TITLES.session,       captureMouse: false, panel: () => this.sessionPanel,        rectFor: l => l.session,  hitVisible: () => true },
      { id: 'orchestration', title: TAB_TITLES.orchestration, captureMouse: false, panel: () => this.canvasPanel,         rectFor: l => l.canvas,   hitVisible: a => a !== 'config' && a !== 'terminal' },
      { id: 'agents',        title: TAB_TITLES.agents,        captureMouse: false, panel: () => this.agentsPanel,         rectFor: l => l.agents,   hitVisible: a => a !== 'config' && a !== 'terminal' },
      { id: 'terminal',      title: TAB_TITLES.terminal,      captureMouse: false, panel: () => this.ensureTerminalPanel(), rectFor: l => l.terminal, hitVisible: a => a === 'terminal' },
      { id: 'config',        title: TAB_TITLES.config,        captureMouse: true,  panel: () => this.configPanel!,        rectFor: l => l.config,   hitVisible: a => a === 'config' },
      ...featureTabs,
    ]

    const switchTab = (id: TabId) => () => { this.activeTab = id; this.render() }
    this.palette = new CommandPalette([
      { id: 'switch-session',       label: 'Switch to Session',       hint: 'F1',     action: switchTab('session') },
      { id: 'switch-orchestration', label: 'Switch to Orchestration', hint: 'F2',     action: switchTab('orchestration') },
      { id: 'switch-agents',        label: 'Switch to Agents',        hint: 'F3',     action: switchTab('agents') },
      { id: 'switch-terminal',      label: 'Switch to Terminal',      hint: 'F4',     action: switchTab('terminal') },
      { id: 'switch-config',        label: 'Switch to Config',        hint: 'F5',     action: switchTab('config') },
      { id: 'switch-logs',          label: 'Switch to Logs',          hint: 'F6',     action: switchTab('logs') },
      { id: 'login',                label: 'Login to AgentFactory',   hint: '',       action: () => { this.activeTab = 'config'; void this.runLoginFlow() } },
      { id: 'logout',               label: 'Logout from AgentFactory',hint: '',       action: () => { void this.runLogout() } },
      { id: 'run-plan',             label: 'Run Plan',                hint: 'Ctrl+R', action: () => { void this.runPlan() } },
      { id: 'clear-session',        label: 'Clear Session',           hint: '',       action: () => { this.sessionPanel.clearSession(); this.render() } },
      { id: 'help',                 label: 'Help: keyboard shortcuts',hint: '?',      action: () => { this.help.open(this.activeTab); this.render() } },
      { id: 'theme-default',        label: 'Theme: default',          hint: '',       action: () => { this.applySetting('theme', 'default') } },
      { id: 'theme-high-contrast',  label: 'Theme: high contrast',    hint: '',       action: () => { this.applySetting('theme', 'high-contrast') } },
      { id: 'toggle-motion',        label: 'Toggle reduced motion',   hint: '',       action: () => { this.applySetting('reducedMotion', store.getSetting('reducedMotion') === 'true' ? 'false' : 'true') } },
      { id: 'size-compact',         label: 'Size profile: Compact (80×24)',   hint: '', action: () => { this.applySetting('sizeProfile', 'compact') } },
      { id: 'size-standard',        label: 'Size profile: Standard (110×30)', hint: '', action: () => { this.applySetting('sizeProfile', 'standard') } },
      { id: 'size-wide',            label: 'Size profile: Wide (140×40)',     hint: '', action: () => { this.applySetting('sizeProfile', 'wide') } },
      { id: 'quit',                 label: 'Quit',                    hint: 'Ctrl+Q', action: () => { this.stop() } },
    ])

    this.help = new HelpOverlay(this.keymap, () => this.render())
    this.buildKeymap()
    this.controller = new InputController(this.controllerHost(), this.router, this.keymap)
  }

  /** Apply + persist a UI setting, refreshing dependent subsystems. */
  private applySetting(key: string, value: string): void {
    store.setSetting(key, value)
    if (key === 'theme') setTheme(value === 'high-contrast' ? 'high-contrast' : 'default')
    if (key === 'reducedMotion') refreshMotionSetting()
    this.render()
  }

  /** Declarative bindings — the old listenInput if-chain as data (gap 3-doc). */
  private buildKeymap(): void {
    const switchTo = (id: TabId, desc: string, key: string): KeyBindingDef => ({
      id: `tab.${id}`, keys: [key], description: desc,
      run: () => {
        if (id === 'session' && this.activeTab === 'session') this.sessionPanel.openNewSessionMenu()
        this.activeTab = id
        this.render()
      },
    })
    this.keymap.add([
      { id: 'app.quit', keys: ['ctrl+q'], description: 'Quit', run: () => this.stop() },
      {
        id: 'app.copyOrQuit', keys: ['ctrl+c'], description: 'Copy selection (Session) / quit',
        run: () => {
          if (this.activeTab === 'session' && this.sessionPanel.hasSelection()) {
            this.sessionPanel.copySelection()
            this.sessionPanel.clearSelection()
            this.render()
            return
          }
          this.stop()
        },
      },
      { id: 'app.selectCopy', keys: ['ctrl+e'], description: 'Toggle native text selection', run: () => this.toggleMouseCapture() },
      {
        id: 'app.nextTab', keys: ['tab'], description: 'Next tab',
        run: () => { this.activeTab = tabIdAt(tabIndex(this.activeTab) + 1); this.render() },
      },
      switchTo('session', 'Session tab (again: new session)', 'f1'),
      switchTo('orchestration', 'Orchestration tab', 'f2'),
      switchTo('agents', 'Agents tab', 'f3'),
      switchTo('terminal', 'Terminal tab', 'f4'),
      switchTo('config', 'Config tab', 'f5'),
      switchTo('logs', 'Logs tab', 'f6'),
      {
        id: 'plan.run', keys: ['ctrl+r'], description: 'Run the loaded plan', panelFirst: true,
        run: () => { void this.runPlan() },
      },
      {
        id: 'help.show', keys: ['?'], description: 'This help',
        run: () => { this.help.open(this.activeTab); this.render() },
      },
    ])
    for (const f of loadedFeatures()) {
      if (f.keybindings) this.keymap.add(f.keybindings(this.featureCtx()))
    }
  }

  /** Services + host operations injected into features (ddd/11). */
  private featureCtx(): FeatureCtx {
    return {
      scheduleRender: () => this.scheduleRender(),
      render: () => this.render(),
      store,
      layout: () => this.layout(),
      showError: (msg) => this.showError(msg),
      switchTab: (id) => { this.activeTab = id; this.render() },
      services: this.services,
    }
  }

  /** Current layout with the user's divider preferences applied. */
  private layout(): ReturnType<typeof computeLayout> {
    return computeLayout(this.rows, this.cols, this.layoutPrefs)
  }

  /** The narrow surface InputController drives (gap 9 extraction). */
  private controllerHost(): ControllerHost {
    return {
      dims: () => ({ rows: this.rows, cols: this.cols }),
      tabs: () => this.tabs,
      activeTab: () => this.activeTab,
      setActiveTab: (id) => { this.activeTab = id },
      hitAt: (row, col) => this.hitMap.at(row, col),
      palette: this.palette,
      isPaletteOpen: () => this.paletteOpen,
      setPaletteOpen: (open) => { this.paletteOpen = open },
      help: {
        isOpen: () => this.help.isOpen,
        onKey: (e) => this.help.onKey(e),
        onMouse: (e) => this.help.onMouse(e, { row: 0, col: 0, height: this.rows, width: this.cols }),
      },
      textInputActive: () =>
        this.activeTab === 'session' ||
        (this.activeTab === 'config' && (this.configPanel?.isEditing ?? false)),
      layoutOf: (id) => {
        const tab = this.tabs.find(t => t.id === id)
        return tab ? tab.rectFor(this.layout()) : this.layout().session
      },
      terminal: () => this.ensureTerminalPanel(),
      session: {
        openNewSessionMenu: () => this.sessionPanel.openNewSessionMenu(),
        openModelPicker:    () => this.sessionPanel.openModelPicker(),
        toggleChatMode:     () => this.sessionPanel.toggleChatMode(),
        hasSelection:       () => this.sessionPanel.hasSelection(),
        copySelection:      () => this.sessionPanel.copySelection(),
        clearSelection:     () => this.sessionPanel.clearSelection(),
      },
      dragDivider: (id, row, col, commit) => this.dragDivider(id, row, col, commit),
      stop: () => this.stop(),
      render: () => this.render(),
    }
  }

  /** Divider drag (gap 20): live ratio update, persisted on release. */
  private dragDivider(id: 'divider:v' | 'divider:h', row: number, col: number, commit: boolean): void {
    if (id === 'divider:v') {
      this.layoutPrefs.sessionRatio = col / this.cols
    } else {
      const mainHeight = this.rows - 2
      this.layoutPrefs.canvasRatio = (row - 1) / Math.max(1, mainHeight)
    }
    if (commit) {
      if (this.layoutPrefs.sessionRatio !== undefined) {
        store.setSetting('layout.sessionRatio', this.layoutPrefs.sessionRatio.toFixed(3))
      }
      if (this.layoutPrefs.canvasRatio !== undefined) {
        store.setSetting('layout.canvasRatio', this.layoutPrefs.canvasRatio.toFixed(3))
      }
    }
  }

  // VT-GAP-08: lazy PTY spawn — only on first switch to Terminal tab
  private ensureTerminalPanel(): TerminalPanel {
    if (!this.terminalPanel) {
      const layout = this.layout()
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

  private async runLoginFlow(): Promise<void> {
    if (!this.configPanel) return
    this.activeTab = 'config'
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
      const layout = this.layout()
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
    for (const f of loadedFeatures()) f.stop?.()
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

    // Size-profile guard (gaps 21/22): below the selected minimum, show the
    // guard screen instead of a broken layout. Input still works behind it.
    const profile = activeProfile(store)
    if (!sizeCheck(this.rows, this.cols, profile).ok) {
      renderTooSmall(this.buf, this.rows, this.cols, profile)
      if (this.paletteOpen) this.palette.render(this.buf, this.rows, this.cols)
      const guardDiff = this.buf.diff(this.prev)
      if (guardDiff) process.stdout.write(guardDiff)
      this.prev = this.buf.clone()
      return
    }

    const layout = this.layout()
    this.hitMap.clear()

    this.buf.fill(0, 0, this.rows, this.cols, ' ', { bg: Colors.surface })
    this.renderTabBar(layout.tabBar.row)

    // Left column — always visible
    drawBorder(this.buf, layout.session, 'Session', this.activeTab === 'session')
    this.sessionPanel.rect    = layout.session
    this.sessionPanel.focused = this.activeTab === 'session'
    this.sessionPanel.render(this.buf)

    if (this.activeTab === 'config') {
      drawBorder(this.buf, layout.config, 'Config', true)
      this.configPanel!.rect    = layout.config
      this.configPanel!.focused = true
      this.configPanel!.render(this.buf)
    } else if (this.activeTab === 'logs') {
      drawBorder(this.buf, layout.logs, 'Logs', true)
      this.logsPanel.rect    = layout.logs
      this.logsPanel.focused = true
      this.logsPanel.render(this.buf)
    } else if (this.activeTab === 'terminal') {
      const tp = this.ensureTerminalPanel()
      drawBorder(this.buf, layout.terminal, 'Terminal', true)
      tp.rect    = layout.terminal
      tp.focused = true
      tp.render(this.buf)
    } else {
      drawBorder(this.buf, layout.canvas, 'Orchestration', this.activeTab === 'orchestration')
      drawBorder(this.buf, layout.agents, 'Agents',        this.activeTab === 'agents')

      this.canvasPanel.rect    = layout.canvas
      this.canvasPanel.focused = this.activeTab === 'orchestration'
      this.canvasPanel.render(this.buf)

      this.refreshAgents()
      this.agentsPanel.rect    = layout.agents
      this.agentsPanel.focused = this.activeTab === 'agents'
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
    const sbRow = layout.statusBar.row
    if (sbLayout.modelTagCol >= 0) {
      this.hitMap.set('statusbar:model', { row: sbRow, col: sbLayout.modelTagCol, height: 1, width: sbLayout.modelTagLen })
    }
    if (sbLayout.toolToggleCol >= 0) {
      this.hitMap.set('statusbar:tools', { row: sbRow, col: sbLayout.toolToggleCol, height: 1, width: sbLayout.toolToggleLen })
    }

    // Adjustable split dividers (gap 20) — the shared border columns/rows
    this.hitMap.set('divider:v', { row: 1, col: layout.canvas.col, height: this.rows - 2, width: 1 })
    if (this.activeTab !== 'terminal' && this.activeTab !== 'config' && this.activeTab !== 'logs') {
      this.hitMap.set('divider:h', { row: layout.agents.row, col: layout.agents.col, height: 1, width: layout.agents.width })
    }

    if (this.paletteOpen) this.palette.render(this.buf, this.rows, this.cols)
    this.help.render(this.buf, { row: 0, col: 0, height: this.rows, width: this.cols })

    const diff = this.buf.diff(this.prev)
    if (diff) process.stdout.write(diff)
    this.prev = this.buf.clone()
  }

  /** Draw the tab bar and register its clickable zones in the HitMap. */
  private renderTabBar(row: number): void {
    const titles = this.tabs.map(t => t.title)
    const spans = tabLabelSpans(titles)
    for (let i = 0; i < this.tabs.length; i++) {
      const label = ` ${titles[i]} `
      const active = this.tabs[i]!.id === this.activeTab
      this.buf.write(row, spans[i]!.col, label, {
        fg: active ? Colors.surface  : Colors.textDim,
        bg: active ? Colors.primary  : Colors.surfacePanel,
        bold: active,
      })
      this.hitMap.set(`tab:${i}`, { row, col: spans[i]!.col, height: 1, width: spans[i]!.width })
    }
    // Exit button — right-aligned in the tab bar; registered last so it wins
    // over overlapping tab labels on narrow terminals
    const exitCol = this.cols - EXIT_BTN.length - 1
    this.buf.write(row, exitCol, EXIT_BTN, { fg: Colors.surface, bg: Colors.danger, bold: true })
    this.hitMap.set('exit-btn', { row, col: exitCol, height: 1, width: EXIT_BTN.length })
  }
}
