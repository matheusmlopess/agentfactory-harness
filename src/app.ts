import { appendFile } from 'node:fs/promises'
import { CellBuffer } from '@factory/shared/renderer/cell-buffer.js'
import { computeLayout, drawBorder, type LayoutPrefs } from '@factory/shared/renderer/layout.js'
import { renderStatusBar } from '@factory/shared/widgets/StatusBar.js'
import { Colors, setTheme } from '@factory/shared/renderer/theme.js'
import { activeProfile, sizeCheck, renderTooSmall } from '@factory/shared/renderer/size-profiles.js'
import * as A from '@factory/shared/renderer/ansi.js'
import { InputRouter } from '@factory/shared/input/router.js'
import { InputController, type ControllerHost } from '@factory/shared/input/controller.js'
import { HitMap } from '@factory/shared/input/hit-test.js'
import { Keymap } from '@factory/shared/input/keymap.js'
import { HelpOverlay } from '@factory/shared/widgets/HelpOverlay.js'
import { CommandPalette, type PaletteCommand } from '@factory/shared/widgets/CommandPalette.js'
import { type TabEntry, type TabId, tabIndex, tabIdAt } from '@factory/shared/tabs.js'
import { tabLabelSpans, EXIT_BTN } from '@factory/shared/tab-bar.js'
import { applySetting } from '@factory/shared/settings.js'
import type { Panel } from '@factory/shared/panel.js'
import { registerTool } from '@factory/core/tools/index.js'
import { BashTool } from '@factory/core/tools/bash.js'
import { ReadTool } from '@factory/core/tools/read.js'
import { WriteTool } from '@factory/core/tools/write.js'
import { WebFetchTool } from '@factory/core/tools/web-fetch.js'
import { store } from '@factory/core/config/store.js'
import { logger, getLogFilePath } from '@factory/core/logger.js'
import { getVersion } from '@factory/core/version.js'
import { registerFeature, loadedFeatures, resetFeatures } from './features/registry.js'
import {
  createServiceRegistry,
  type FeatureCtx, type SessionBridge, type PlanBridge,
} from '@factory/contracts/index.js'
import { sessionFeature } from './features/session/index.js'
import { canvasFeature } from './features/canvas/index.js'
import { agentsFeature } from './features/agents/index.js'
import { terminalFeature } from './features/terminal/index.js'
import { configFeature } from './features/config/index.js'
import { logsFeature } from './features/logs/index.js'
import type { TerminalPanel } from './features/terminal/panel.js'
import { ConfigPanel } from './features/config/panel.js'

const log = logger('App')

/**
 * Thin host (ddd/11): loads features from the registry, builds the tab bar,
 * palette, and keymap from their contributions, runs the render loop, and
 * wires the InputController. Feature logic lives in src/features/*.
 */
export class App {
  private rows = process.stdout.rows ?? 24
  private cols = process.stdout.columns ?? 80
  private buf: CellBuffer
  private prev: CellBuffer
  private activeTab: TabId = 'session'
  private running = false
  private renderPending = false
  private statusError: string | null = null
  private statusErrorTimer: ReturnType<typeof setTimeout> | null = null
  private palette!: CommandPalette
  private paletteOpen = false
  private tabs!: TabEntry[]
  private readonly services = createServiceRegistry()
  /** Last render-failure message per tab, to avoid logging every frame. */
  private readonly panelRenderErrors = new Map<TabId, string>()
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
    this.initFeatures()
    log.debug('features initialized', { count: loadedFeatures().length })
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

  /** Register all features and build tabs / palette / keymap from them. */
  private initFeatures(): void {
    resetFeatures()
    registerFeature(sessionFeature())
    registerFeature(canvasFeature())
    registerFeature(agentsFeature())
    registerFeature(terminalFeature())
    registerFeature(configFeature())
    registerFeature(logsFeature())

    const ctx = this.featureCtx()

    // Tabs — panel construction is lazy (first access), so the Terminal PTY
    // spawns only when its tab is first shown (VT-GAP-08 preserved)
    this.tabs = loadedFeatures().flatMap(f => {
      const tab = f.tab
      if (!tab) return []
      let panel: Panel | null = null
      const entry: TabEntry = {
        id: tab.id,
        title: tab.title,
        captureMouse: tab.captureMouse,
        panel: () => (panel ??= tab.makePanel(ctx)),
        rectFor: tab.rectFor,
        hitVisible: tab.hitVisible,
      }
      if (tab.beforeRender) entry.beforeRender = tab.beforeRender
      return [entry]
    })

    // Palette — host chrome commands + every feature's contributions
    const switchTab = (id: TabId) => () => { this.activeTab = id; this.render() }
    const commands: PaletteCommand[] = [
      { id: 'switch-session',       label: 'Switch to Session',       hint: 'F1', action: switchTab('session') },
      { id: 'switch-orchestration', label: 'Switch to Orchestration', hint: 'F2', action: switchTab('orchestration') },
      { id: 'switch-agents',        label: 'Switch to Agents',        hint: 'F3', action: switchTab('agents') },
      { id: 'switch-terminal',      label: 'Switch to Terminal',      hint: 'F4', action: switchTab('terminal') },
      { id: 'switch-config',        label: 'Switch to Config',        hint: 'F5', action: switchTab('config') },
      { id: 'switch-logs',          label: 'Switch to Logs',          hint: 'F6', action: switchTab('logs') },
      { id: 'help',                 label: 'Help: keyboard shortcuts', hint: '?', action: () => { this.help.open(this.activeTab); this.render() } },
      { id: 'theme-default',        label: 'Theme: default',          hint: '', action: () => this.applyAndRender('theme', 'default') },
      { id: 'theme-high-contrast',  label: 'Theme: high contrast',    hint: '', action: () => this.applyAndRender('theme', 'high-contrast') },
      { id: 'toggle-motion',        label: 'Toggle reduced motion',   hint: '', action: () => this.applyAndRender('reducedMotion', store.getSetting('reducedMotion') === 'true' ? 'false' : 'true') },
      { id: 'size-compact',         label: 'Size profile: Compact (80×24)',   hint: '', action: () => this.applyAndRender('sizeProfile', 'compact') },
      { id: 'size-standard',        label: 'Size profile: Standard (110×30)', hint: '', action: () => this.applyAndRender('sizeProfile', 'standard') },
      { id: 'size-wide',            label: 'Size profile: Wide (140×40)',     hint: '', action: () => this.applyAndRender('sizeProfile', 'wide') },
      { id: 'quit',                 label: 'Quit', hint: 'Ctrl+Q', action: () => { this.stop() } },
    ]
    for (const f of loadedFeatures()) {
      if (f.commands) commands.push(...f.commands(ctx))
    }
    this.palette = new CommandPalette(commands)

    this.help = new HelpOverlay(this.keymap, () => this.render())
    this.buildKeymap(ctx)
    this.controller = new InputController(this.controllerHost(), this.router, this.keymap)
  }

  private applyAndRender(key: string, value: string): void {
    applySetting(store, key, value)
    this.render()
  }

  private sessionBridge(): SessionBridge | undefined {
    return this.services.get('session')
  }

  private planBridge(): PlanBridge | undefined {
    return this.services.get('plan')
  }

  private tabEntry(id: TabId): TabEntry | undefined {
    return this.tabs.find(t => t.id === id)
  }

  /** Declarative host bindings — the old listenInput if-chain as data. */
  private buildKeymap(ctx: FeatureCtx): void {
    const switchTo = (id: TabId, desc: string, key: string) => ({
      id: `tab.${id}`, keys: [key], description: desc,
      run: () => {
        if (id === 'session' && this.activeTab === 'session') this.sessionBridge()?.openNewSessionMenu()
        this.activeTab = id
        this.render()
      },
    })
    this.keymap.add([
      { id: 'app.quit', keys: ['ctrl+q'], description: 'Quit', run: () => this.stop() },
      {
        id: 'app.copyOrQuit', keys: ['ctrl+c'], description: 'Copy selection (Session) / quit',
        run: () => {
          const session = this.sessionBridge()
          if (this.activeTab === 'session' && session?.hasSelection()) {
            session.copySelection()
            session.clearSelection()
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
        id: 'help.show', keys: ['?'], description: 'This help',
        run: () => { this.help.open(this.activeTab); this.render() },
      },
    ])
    for (const f of loadedFeatures()) {
      if (f.keybindings) this.keymap.add(f.keybindings(ctx))
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
      textInputActive: () => {
        if (this.activeTab === 'session') return true
        if (this.activeTab === 'config') {
          const panel = this.tabEntry('config')?.panel()
          return panel instanceof ConfigPanel && panel.isEditing
        }
        return false
      },
      layoutOf: (id) => {
        const tab = this.tabEntry(id)
        return tab ? tab.rectFor(this.layout()) : this.layout().session
      },
      terminal: () => this.tabEntry('terminal')!.panel() as TerminalPanel,
      session: {
        openNewSessionMenu: () => this.sessionBridge()?.openNewSessionMenu(),
        openModelPicker:    () => this.sessionBridge()?.openModelPicker(),
        toggleChatMode:     () => this.sessionBridge()?.toggleChatMode(),
        hasSelection:       () => this.sessionBridge()?.hasSelection() ?? false,
        copySelection:      () => this.sessionBridge()?.copySelection(),
        clearSelection:     () => this.sessionBridge()?.clearSelection(),
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
      for (const tab of this.tabs) {
        const panel = tab.panel()
        panel.rect = tab.rectFor(layout)
        if (tab.id === 'terminal') {
          const tp = panel as TerminalPanel
          const inner = tp.inner
          tp.resize(inner.height, inner.width)
        }
      }
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

  /** Render one tab's bordered panel.
   *  A panel that throws mid-render paints an error state instead of killing
   *  the whole TUI via uncaughtException. Note this only catches throws — it
   *  cannot interrupt a panel that never returns (infinite loop); those must
   *  be fixed at the source. */
  private renderTab(id: TabId, rect: ReturnType<typeof computeLayout>['session'], title: string, focused: boolean): void {
    const tab = this.tabEntry(id)
    if (!tab) return
    drawBorder(this.buf, rect, title, focused)
    const panel = tab.panel()
    panel.rect = rect
    panel.focused = focused
    try {
      tab.beforeRender?.()
      panel.render(this.buf)
    } catch (err) {
      const msg = err instanceof Error ? err.stack ?? err.message : String(err)
      if (this.panelRenderErrors.get(id) !== msg) {
        this.panelRenderErrors.set(id, msg)
        log.error('panel render failed', { tab: id, error: msg })
      }
      this.buf.fill(rect.row + 1, rect.col + 1, Math.max(0, rect.height - 2), Math.max(0, rect.width - 2), ' ', { bg: Colors.surfacePanel })
      const warn = ` ⚠ ${title} failed to render — see Logs `.substring(0, Math.max(0, rect.width - 2))
      this.buf.write(rect.row + Math.floor(rect.height / 2), rect.col + 1, warn, { fg: Colors.danger, bg: Colors.surfacePanel, bold: true })
    }
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
    this.renderTab('session', layout.session, 'Session', this.activeTab === 'session')

    if (this.activeTab === 'config') {
      this.renderTab('config', layout.config, 'Config', true)
    } else if (this.activeTab === 'logs') {
      this.renderTab('logs', layout.logs, 'Logs', true)
    } else if (this.activeTab === 'terminal') {
      this.renderTab('terminal', layout.terminal, 'Terminal', true)
    } else {
      this.renderTab('orchestration', layout.canvas, 'Orchestration', this.activeTab === 'orchestration')
      this.renderTab('agents', layout.agents, 'Agents', this.activeTab === 'agents')
    }

    // Always show a model tag — selected ID or "select model" as a click prompt
    const session = this.sessionBridge()
    const modelLabel = session?.getSelectedModel()?.id ?? 'select model'
    const planRunning = this.planBridge()?.isRunning() ?? false
    const mode = planRunning ? 'running' : this.mouseEnabled ? 'NORMAL' : 'SELECT'
    const sbLayout = renderStatusBar(
      this.buf, layout.statusBar,
      mode,
      this.statusError ?? undefined,
      modelLabel,
      session?.getChatMode(),
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
