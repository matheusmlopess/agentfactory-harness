import { parseKey } from './keyboard.js'
import { parseMouse } from './mouse.js'
import type { InputRouter } from './router.js'
import type { TabEntry, TabId } from '../tabs.js'
import { tabIdAt, tabIndex, TAB_ORDER } from '../tabs.js'
import type { CommandPalette } from '../widgets/CommandPalette.js'
import { computeLayout } from '../renderer/layout.js'

/** PTY-backed terminal surface (raw byte forwarding + scrollback). */
export interface TerminalTarget {
  write(data: Buffer): void
  scrollBack(): void
  scrollForward(): void
}

/**
 * The narrow surface the input state machine needs from the host app.
 * Everything else (rendering, panel construction) stays in the host.
 */
export interface ControllerHost {
  dims(): { rows: number; cols: number }
  tabs(): readonly TabEntry[]
  activeTab(): TabId
  setActiveTab(id: TabId): void
  /** HitMap lookup: 'exit-btn' | 'tab:<i>' | 'statusbar:model' | 'statusbar:tools' | null. */
  hitAt(row: number, col: number): string | null
  palette: CommandPalette
  isPaletteOpen(): boolean
  setPaletteOpen(open: boolean): void
  terminal(): TerminalTarget
  /** Session-tab specific operations (Ctrl+C copy, F1/new-session, status bar). */
  session: {
    openNewSessionMenu(): void
    openModelPicker(): void
    toggleChatMode(): void
    hasSelection(): boolean
    copySelection(): void
    clearSelection(): void
  }
  runPlan(): void
  toggleMouseCapture(): void
  stop(): void
  render(): void
}

/**
 * The stdin input state machine, extracted verbatim from app.ts listenInput()
 * (gap 9). Exported handleData() lets tests feed byte buffers without a TTY.
 */
export class InputController {
  constructor(
    private readonly host: ControllerHost,
    private readonly router: InputRouter,
  ) {}

  attach(stdin: NodeJS.ReadStream): void {
    stdin.setRawMode(true)
    stdin.resume()
    stdin.on('data', (data: Buffer) => this.handleData(data))
  }

  handleData(data: Buffer): void {
    // When Terminal tab is active, bypass parseKey and forward raw bytes
    // to the PTY. Only intercept control chords via raw byte patterns.
    if (this.host.activeTab() === 'terminal') {
      this.handleTerminalData(data)
      return
    }

    // Mouse event — try before keyboard (non-terminal tabs only)
    const mouse = parseMouse(data)
    if (mouse) {
      this.handleMouse(mouse)
      return
    }

    const key = parseKey(data)
    if (!key) {
      this.handlePaste(data)
      return
    }
    this.handleKey(key)
  }

  // ── Terminal tab raw bypass (moved verbatim — byte patterns unchanged) ────

  private handleTerminalData(data: Buffer): void {
    const host = this.host
    if (data[0] === 0x11) { host.stop(); return }                  // Ctrl+Q
    if (data[0] === 0x10) {                                        // Ctrl+P
      host.setPaletteOpen(!host.isPaletteOpen())
      if (host.isPaletteOpen()) host.palette.openPalette()
      host.render()
      return
    }

    // When palette is open in terminal mode, route input to palette — never to PTY
    if (host.isPaletteOpen()) {
      const key = parseKey(data)
      if (key) {
        host.palette.onKey(key)
        if (!host.palette.isOpen) host.setPaletteOpen(false)
      }
      host.render()
      return
    }

    // VT-GAP-04: match both xterm (\x1bOP) and VT100 (\x1b[11~) F-key forms
    const s = data.toString('binary')
    if (s === '\x1bOP' || s === '\x1b[11~') { host.setActiveTab('session');       host.render(); return } // F1
    if (s === '\x1bOQ' || s === '\x1b[12~') { host.setActiveTab('orchestration'); host.render(); return } // F2
    if (s === '\x1bOR' || s === '\x1b[13~') { host.setActiveTab('agents');        host.render(); return } // F3
    if (s === '\x1bOS' || s === '\x1b[14~') return                                                        // F4 — already on Terminal, no-op
    if (s === '\x1b[15~')                   { host.setActiveTab('config');        host.render(); return } // F5 → Config

    // Shift+PgUp / Shift+PgDn — scroll terminal scrollback
    if (s === '\x1b[5;2~') { host.terminal().scrollBack();    host.render(); return }
    if (s === '\x1b[6;2~') { host.terminal().scrollForward(); host.render(); return }

    // SGR mouse events: intercept tab bar clicks, suppress the rest from reaching PTY
    if (s.startsWith('\x1b[<')) {
      const mouse = parseMouse(data)
      if (mouse) {
        if (host.isPaletteOpen()) {
          const { rows, cols } = host.dims()
          host.palette.onMouse(mouse, rows, cols)
          if (!host.palette.isOpen) host.setPaletteOpen(false)
          host.render()
          return
        }
        if (mouse.button === 'left' && mouse.action === 'press' && mouse.row === 0) {
          const hit = host.hitAt(mouse.row, mouse.col)
          if (hit === 'exit-btn') { host.stop(); return }
          if (hit?.startsWith('tab:')) {
            host.setActiveTab(tabIdAt(Number(hit.slice(4))))
            host.render()
          }
        }
      }
      return
    }

    this.host.terminal().write(data)
  }

  // ── Mouse (non-terminal tabs) ──────────────────────────────────────────────

  private handleMouse(mouse: import('./mouse.js').MouseEvent): void {
    const host = this.host

    // Shift+click: pass through to terminal for native text selection
    if (mouse.shift) return

    // Palette overlay intercepts ALL mouse when open — nothing behind it is clickable
    if (host.isPaletteOpen()) {
      const { rows, cols } = host.dims()
      host.palette.onMouse(mouse, rows, cols)
      if (!host.palette.isOpen) host.setPaletteOpen(false)
      host.render()
      return
    }

    if (mouse.button === 'left' && mouse.action === 'press') {
      const hit = host.hitAt(mouse.row, mouse.col)
      // Tab bar click
      if (hit === 'exit-btn') { host.stop(); return }
      if (hit?.startsWith('tab:')) {
        const id = tabIdAt(Number(hit.slice(4)))
        // Clicking the Session tab while already on it opens the New Session menu
        if (id === 'session' && host.activeTab() === 'session') host.session.openNewSessionMenu()
        host.setActiveTab(id)
        host.render()
        return
      }
      // Status bar model tag click → open model picker in session panel
      if (hit === 'statusbar:model') {
        host.setActiveTab('session')
        host.session.openModelPicker()
        host.render()
        return
      }
      // Status bar tool toggle click → toggle chat mode
      if (hit === 'statusbar:tools') {
        host.session.toggleChatMode()
        host.render()
        return
      }
      // Panel body click — focus the panel under the cursor
      const clickedTab = this.router.tabAt(mouse.row, mouse.col, host.tabs(), host.activeTab())
      if (clickedTab !== null && clickedTab !== host.activeTab()) {
        host.setActiveTab(clickedTab)
      }
    }

    // Capture-mode tabs (Config, Logs) own all mouse events while active —
    // always render after: scroll/click both mutate state needing repaint.
    const active = host.tabs().find(t => t.id === host.activeTab())
    if (active?.captureMouse) {
      const { rows, cols } = host.dims()
      const panel = active.panel()
      panel.rect = active.rectFor(computeLayout(rows, cols))  // set rect BEFORE dispatch
      panel.onMouse(mouse)
      host.render()
      return
    }

    // Only repaint when the panel actually consumed the event — avoids a
    // full render on every passive-motion (mode 1003) event.
    if (this.router.dispatchMouse(mouse, host.tabs(), host.activeTab())) host.render()
  }

  // ── Paste (bracketed or raw multi-char) ────────────────────────────────────

  private handlePaste(data: Buffer): void {
    const host = this.host
    let str = data.toString('utf8')
    str = str.replace(/^\x1b\[200~/, '').replace(/\x1b\[201~$/, '')
    if (str.length > 0 && !str.startsWith('\x1b')) {
      for (const ch of str) {
        if (ch >= ' ' && ch !== '\x7f') {
          const fakeKey = { key: ch, raw: Buffer.from(ch) }
          if (host.isPaletteOpen()) {
            host.palette.onKey(fakeKey)
            if (!host.palette.isOpen) host.setPaletteOpen(false)
          } else {
            this.router.dispatchKey(fakeKey, host.tabs(), host.activeTab())
          }
        }
      }
      host.render()
    }
  }

  // ── Keys (non-terminal tabs) ───────────────────────────────────────────────

  private handleKey(key: import('./keyboard.js').KeyEvent): void {
    const host = this.host

    if (key.key === 'ctrl+q') {
      host.stop()
      return
    }

    // Ctrl+C — copy session selection if one exists; otherwise quit
    if (key.key === 'ctrl+c') {
      if (host.activeTab() === 'session' && host.session.hasSelection()) {
        host.session.copySelection()
        host.session.clearSelection()
        host.render()
        return
      }
      host.stop()
      return
    }

    // Ctrl+E — toggle mouse capture so native terminal text selection/copy works
    if (key.key === 'ctrl+e') {
      host.toggleMouseCapture()
      return
    }

    // Ctrl+P — toggle palette (works from any non-terminal tab)
    if (key.key === 'ctrl+p') {
      host.setPaletteOpen(!host.isPaletteOpen())
      if (host.isPaletteOpen()) host.palette.openPalette()
      host.render()
      return
    }

    // Route all keys to palette when open
    if (host.isPaletteOpen()) {
      host.palette.onKey(key)
      if (!host.palette.isOpen) host.setPaletteOpen(false)
      host.render()
      return
    }

    if (key.key === 'tab') {
      host.setActiveTab(tabIdAt(tabIndex(host.activeTab()) + 1))
      host.render()
      return
    }

    // F1–F6 switch panels without stealing printable characters
    const fkeyTargets: Record<string, TabId> = {
      f1: 'session', f2: 'orchestration', f3: 'agents',
      f4: 'terminal', f5: 'config', f6: 'logs',
    }
    const fkeyTarget = fkeyTargets[key.key]
    if (fkeyTarget !== undefined) {
      if (fkeyTarget === 'session' && host.activeTab() === 'session') host.session.openNewSessionMenu()
      host.setActiveTab(fkeyTarget)
      host.render()
      return
    }

    // Ctrl+R — run the loaded plan (no-op if no plan or already running).
    // Config's browse mode consumes ctrl+r first (clear key) — preserved by
    // dispatching to the active panel and only falling back when unconsumed.
    if (key.key === 'ctrl+r') {
      const consumedByPanel = this.router.dispatchKey(key, host.tabs(), host.activeTab())
      if (!consumedByPanel) host.runPlan()
      return
    }

    const consumed = this.router.dispatchKey(key, host.tabs(), host.activeTab())
    if (!consumed) host.render()
  }
}

export { TAB_ORDER }
