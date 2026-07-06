import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import type { KeyEvent } from '../input/keyboard.js'
import type { MouseEvent } from '../input/mouse.js'
import { Colors } from '../renderer/theme.js'
import { store } from '../../core/config/store.js'
import { providersByCategory, PROVIDERS } from '../../core/config/providers.js'
import type { ProviderDef, Category } from '../../core/config/providers.js'
import type { AuthUser } from '../../registry/auth.js'
import type { LoginEvent } from '../../registry/login.js'
import type { ImportCandidate } from '../../registry/import-keys.js'
import { logger } from '../../core/logger.js'
import { maskSecret } from '../../core/config/mask.js'
import { Overlay } from '../widgets/Overlay.js'

type PanelMode = 'browse' | 'edit' | 'login' | 'import'

export interface ConfigPanelCallbacks {
  onLogin?:  () => void
  onLogout?: () => void
  onImport?: () => void
}

// A rendered row is either a category header or a provider entry
type RowItem = { kind: 'header'; category: Category } | { kind: 'entry'; def: ProviderDef; entryIdx: number }

const CATEGORY_LABELS: Record<Category, string> = {
  api:       'API Providers',
  cli:       'CLI Tools',
  ide:       'IDE / Editor',
  framework: 'Agent Frameworks',
  local:     'Local Models',
}

const DOUBLE_CLICK_MS = 350
const HEADER_ROWS = 3   // auth-status row + action row + divider
const SPINNER = ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷']

export class ConfigPanel extends Panel {
  // entries[]: only non-alias entries, in category order — the navigation targets
  private readonly entries: ProviderDef[]
  // rows[]: all rendered rows including headers
  private readonly rows: RowItem[]

  private selectedIdx = 0   // index into entries[]
  private scrollTop = 0     // first visible row index in rows[]
  private mode: PanelMode = 'browse'
  private editBuf = ''
  private editPrev = ''
  private lastClickEntryIdx = -1
  private lastClickTime = 0
  private readonly onUpdate: () => void
  private readonly callbacks: ConfigPanelCallbacks
  private log = logger('Config')

  // Auth state
  private authUser: AuthUser | null = null

  // Login overlay state
  private loginUserCode  = ''
  private loginVerifyUrl = ''
  private loginSeconds   = 0
  private loginMessage   = ''   // error or success message
  private spinnerFrame   = 0

  // Import overlay state
  private importCandidates: ImportCandidate[] = []

  // Shared modal frames (gap 8) — content stays bespoke, geometry/dismissal unified
  private readonly editOverlay = new Overlay({
    title: 'Configure', tier: 'md',
    onDismiss: () => { this.mode = 'browse'; this.editBuf = ''; this.onUpdate() },
  })
  private readonly loginOverlay = new Overlay({
    title: 'Login to AgentFactory', tier: 'md',
    onDismiss: () => { this.mode = 'browse'; this.onUpdate() },
  })
  private readonly importOverlay = new Overlay({
    title: 'Import API Keys', tier: 'md',
    onDismiss: () => { this.mode = 'browse'; this.onUpdate() },
  })

  constructor(rect: Rect, onUpdate: () => void, callbacks: ConfigPanelCallbacks = {}) {
    super(rect)
    this.onUpdate  = onUpdate
    this.callbacks = callbacks

    // Build the flat row list and the navigable entries list
    const byCategory = providersByCategory()
    const rowList: RowItem[] = []
    const entryList: ProviderDef[] = []

    for (const [cat, defs] of byCategory) {
      if (defs.length === 0) continue
      rowList.push({ kind: 'header', category: cat })
      for (const def of defs) {
        rowList.push({ kind: 'entry', def, entryIdx: entryList.length })
        entryList.push(def)
      }
    }

    this.rows  = rowList
    this.entries = entryList
    // Start on first non-alias entry
    this.selectedIdx = entryList.findIndex(e => e.aliasOf === undefined)
    if (this.selectedIdx < 0) this.selectedIdx = 0
  }

  // ── Public API for App ────────────────────────────────────────────────────

  setAuthUser(user: AuthUser | null): void {
    this.authUser = user
    this.onUpdate()
  }

  updateLoginEvent(ev: LoginEvent): void {
    // Always enter login overlay on first event (including immediate errors)
    this.mode = 'login'

    if (ev.kind === 'code') {
      this.loginUserCode  = ev.userCode
      this.loginVerifyUrl = ev.verifyUrl
      this.loginSeconds   = ev.expiresIn
      this.loginMessage   = ''
    } else if (ev.kind === 'progress') {
      this.loginSeconds = ev.secondsLeft
      this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER.length
    } else if (ev.kind === 'success') {
      this.authUser = ev.user
      this.loginMessage = `✓ Logged in as @${ev.user.github_handle}`
      setTimeout(() => { this.mode = 'browse'; this.onUpdate() }, 1500)
    } else if (ev.kind === 'error') {
      this.loginMessage = `✗ ${ev.message}`
      setTimeout(() => { this.mode = 'browse'; this.onUpdate() }, 3000)
    }
    this.onUpdate()
  }

  showImportCandidates(candidates: ImportCandidate[]): void {
    this.importCandidates = candidates
    this.mode = 'import'
    this.onUpdate()
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  override render(buf: CellBuffer): void {
    const r = this.inner
    if (r.height < 4 || r.width < 20) return

    // List uses height minus hint bar (2) and auth header (HEADER_ROWS)
    const listHeight = r.height - 2 - HEADER_ROWS

    // Fill background
    buf.fill(r.row, r.col, r.height, r.width, ' ', { bg: Colors.bgPanel })

    // ── Auth header (always visible) ─────────────────────────────────────
    this.renderAuthHeader(buf, r)

    // ── Provider list ──────────────────────────────────────────────────────
    this.ensureVisible(listHeight)

    let screenRow = r.row + HEADER_ROWS
    let rowsRendered = 0
    let rowIdx = this.scrollTop

    while (rowsRendered < listHeight && rowIdx < this.rows.length) {
      const item = this.rows[rowIdx]
      if (!item) { rowIdx++; continue }

      if (item.kind === 'header') {
        const label = `▸ ${CATEGORY_LABELS[item.category]}`
        buf.write(screenRow, r.col, label.substring(0, r.width), { fg: Colors.accent, bg: Colors.bgPanel, bold: true })
        if (rowsRendered + 1 < listHeight) {
          buf.write(screenRow + 1, r.col, '─'.repeat(r.width), { fg: Colors.border, bg: Colors.bgPanel })
          screenRow += 2; rowsRendered += 2
        } else {
          screenRow++; rowsRendered++
        }
      } else {
        const def = item.def
        const isSelected = this.entries[this.selectedIdx] === def
        const isAlias = def.aliasOf !== undefined

        const namePrefix = isSelected ? '► ' : '  '
        const nameFg = isAlias ? Colors.textDim : (isSelected ? Colors.textBright : Colors.text)
        const nameBg = isSelected ? Colors.bgActive : Colors.bgPanel

        const nameCol = Math.floor(r.width * 0.55)
        const nameStr = (namePrefix + def.name).substring(0, nameCol)
        buf.write(screenRow, r.col, nameStr.padEnd(nameCol), { fg: nameFg, bg: nameBg })

        const DEL_BTN = '[✕]'  // 3-char delete button shown when a value is set
        const valCol = r.width - nameCol
        let valStr: string
        let hasValue = false
        if (isAlias) {
          valStr = `(→ ${def.aliasOf})`
        } else {
          const val = store.getKey(def.configKey, def.envVar)
          hasValue = (val !== undefined && val !== '')
          valStr = hasValue ? `${maskSecret(val!, def.fieldType)} [set]` : '(not set)'
        }
        const valFg = isAlias ? Colors.textDim : (hasValue ? Colors.success : Colors.textDim)
        // Leave room for delete button when value is set
        const valWidth = hasValue ? valCol - DEL_BTN.length - 1 : valCol - 1
        buf.write(screenRow, r.col + nameCol, valStr.substring(0, valWidth).padStart(valWidth), { fg: valFg, bg: nameBg })
        if (hasValue) {
          buf.write(screenRow, r.col + r.width - DEL_BTN.length, DEL_BTN, { fg: Colors.error, bg: nameBg, bold: isSelected })
        }

        screenRow++; rowsRendered++
      }
      rowIdx++
    }

    // ── Scroll indicators ─────────────────────────────────────────────────
    if (this.rows.length > rowsRendered) {
      if (this.scrollTop > 0)        buf.write(r.row + HEADER_ROWS, r.col + r.width - 3, ' ▲ ', { fg: Colors.textDim, bg: Colors.bgPanel })
      if (rowIdx < this.rows.length) buf.write(r.row + HEADER_ROWS + listHeight - 1, r.col + r.width - 3, ' ▼ ', { fg: Colors.textDim, bg: Colors.bgPanel })
    }

    // ── Hint bar ──────────────────────────────────────────────────────────
    if (this.mode === 'browse' || this.mode === 'edit') {
      const hintRow = r.row + r.height - 2
      buf.write(hintRow, r.col, '─'.repeat(r.width), { fg: Colors.border, bg: Colors.bgPanel })
      const hint = ' [↑↓] Navigate  [Enter/DblClick] Edit  [Ctrl+R] Delete key  [PgUp/Dn] Scroll'
      buf.write(hintRow + 1, r.col, hint.substring(0, r.width), { fg: Colors.textDim, bg: Colors.bgPanel })
    }

    // ── Edit modal overlay ────────────────────────────────────────────────
    if (this.mode === 'edit') {
      const def = this.entries[this.selectedIdx]
      if (!def) return
      this.renderEditModal(buf, r, def)
    }

    // ── Login overlay ─────────────────────────────────────────────────────
    if (this.mode === 'login') this.renderLoginOverlay(buf, r)

    // ── Import overlay ────────────────────────────────────────────────────
    if (this.mode === 'import') this.renderImportOverlay(buf, r)

    // ── Write error if last persist failed ────────────────────────────────
    if (store.lastWriteError) {
      buf.write(r.row + r.height - 1, r.col, ` ⚠ ${store.lastWriteError} `.substring(0, r.width), { fg: Colors.bg, bg: Colors.error })
    }
  }

  private renderAuthHeader(buf: CellBuffer, r: { row: number; col: number; height: number; width: number }): void {
    // Row 0: auth status
    const statusLine = this.authUser
      ? `● @${this.authUser.github_handle}  (${this.authUser.plan})`
      : '○ Not logged in'
    const statusFg = this.authUser ? Colors.success : Colors.textDim
    buf.write(r.row, r.col, statusLine.padEnd(r.width).substring(0, r.width), { fg: statusFg, bg: Colors.bgPanel, bold: !!this.authUser })

    // Row 1: action buttons
    const loginLabel  = this.authUser ? '  [→ Logout]  ' : '  [→ Login]   '
    const importLabel = '  [→ Import keys from tools]'
    buf.write(r.row + 1, r.col,                       loginLabel.substring(0, Math.floor(r.width / 2)), { fg: Colors.accent, bg: Colors.bgPanel })
    buf.write(r.row + 1, r.col + Math.floor(r.width / 2), importLabel.substring(0, r.width - Math.floor(r.width / 2)), { fg: Colors.info, bg: Colors.bgPanel })

    // Row 2: divider
    buf.write(r.row + 2, r.col, '─'.repeat(r.width), { fg: Colors.border, bg: Colors.bgPanel })
  }

  private renderLoginOverlay(buf: CellBuffer, r: { row: number; col: number; height: number; width: number }): void {
    const f = this.loginOverlay.renderFrame(buf, r, 9)
    const { row: modalRow, col: modalCol, width: modalW } = f

    // Final message (success or error) replaces step content
    if (this.loginMessage) {
      const msgFg = this.loginMessage.startsWith('✓') ? Colors.success : Colors.error
      buf.write(modalRow + 5, modalCol + 2, this.loginMessage.substring(0, modalW - 4), { fg: msgFg, bg: Colors.bgPanel, bold: true })
    } else if (this.loginUserCode) {
      buf.write(modalRow + 2, modalCol + 2, '1. Open this URL in your browser:', { fg: Colors.text, bg: Colors.bgPanel })
      buf.write(modalRow + 3, modalCol + 2, `   ↗  ${this.loginVerifyUrl}`.substring(0, modalW - 4), { fg: Colors.info, bg: Colors.bgPanel, underline: true })
      buf.write(modalRow + 5, modalCol + 2, '2. Enter this code:', { fg: Colors.text, bg: Colors.bgPanel })
      buf.write(modalRow + 6, modalCol + 6, this.loginUserCode, { fg: Colors.textBright, bg: Colors.bgActive, bold: true })
      const spinner = SPINNER[this.spinnerFrame]!
      buf.write(modalRow + 8, modalCol + 2, `${spinner} Waiting…  (${this.loginSeconds}s remaining)`.substring(0, modalW - 4), { fg: Colors.textDim, bg: Colors.bgPanel })
    } else {
      buf.write(modalRow + 5, modalCol + 2, 'Connecting…', { fg: Colors.textDim, bg: Colors.bgPanel })
    }

    buf.write(modalRow + 9, modalCol + 2, '[Esc] Cancel', { fg: Colors.textDim, bg: Colors.bgPanel })
  }

  private renderImportOverlay(buf: CellBuffer, r: { row: number; col: number; height: number; width: number }): void {
    const candidates = this.importCandidates
    const listRows = Math.max(1, candidates.length)
    const f = this.importOverlay.renderFrame(buf, r, 6 + listRows)
    const { row: modalRow, col: modalCol, width: modalW } = f

    if (candidates.length === 0) {
      buf.write(modalRow + 2, modalCol + 2, 'No importable keys found.', { fg: Colors.textDim, bg: Colors.bgPanel })
      buf.write(modalRow + 4, modalCol + 2, '[Esc] Close', { fg: Colors.textDim, bg: Colors.bgPanel })
      return
    }

    buf.write(modalRow + 2, modalCol + 2, `Found ${candidates.length} key${candidates.length > 1 ? 's' : ''}:`, { fg: Colors.text, bg: Colors.bgPanel })
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]!
      const nameW = 14
      const srcW  = 24
      const masked = maskSecret(c.value)
      const line = `  ✓ ${c.name.padEnd(nameW).substring(0, nameW)}  ${masked.padEnd(12).substring(0, 12)}  ${c.source}`.substring(0, modalW - 4)
      buf.write(modalRow + 4 + i, modalCol + 2, line, { fg: Colors.success, bg: Colors.bgPanel })
      void srcW
    }
    buf.write(modalRow + 4 + candidates.length + 1, modalCol + 2, '[Enter] Import all    [Esc] Cancel', { fg: Colors.textDim, bg: Colors.bgPanel })
  }

  private renderEditModal(buf: CellBuffer, r: { row: number; col: number; height: number; width: number }, def: ProviderDef): void {
    const f = this.editOverlay.renderFrame(buf, r, 8, `Configure: ${def.name}`)
    const { row: modalRow, col: modalCol, width: modalW } = f

    // Field label (env var or config key)
    const fieldLabel = def.envVar ?? def.configKey.toUpperCase()
    buf.write(modalRow + 2, modalCol + 2, fieldLabel.substring(0, modalW - 4), { fg: Colors.accent, bg: Colors.bgPanel, bold: true })

    // Format hint
    buf.write(modalRow + 3, modalCol + 2, `Format: ${def.hint}`.substring(0, modalW - 4), { fg: Colors.textDim, bg: Colors.bgPanel })

    // Token URL — row 4; OSC 8 makes it Ctrl+clickable in modern terminals
    if (def.tokenUrl) {
      const urlLabel = `  ↗  ${def.tokenUrl}`
      buf.write(modalRow + 4, modalCol + 2, urlLabel.substring(0, modalW - 4), {
        fg: Colors.info,
        bg: Colors.bgPanel,
        underline: true,
        link: `https://${def.tokenUrl}`,
      })
    }

    // Input field
    const prompt = '  > '
    const cursor = '█'
    const fieldW = modalW - prompt.length - 3
    const inputDisplay = this.editBuf.length > fieldW ? this.editBuf.slice(-fieldW) + cursor : this.editBuf + cursor
    const inputLine = (prompt + inputDisplay).substring(0, modalW - 2).padEnd(modalW - 2)
    buf.write(modalRow + 5, modalCol + 1, inputLine, { fg: Colors.text, bg: Colors.bgActive })

    // Ctrl+click hint — row 6 (only when a link is shown)
    if (def.tokenUrl) {
      buf.write(modalRow + 6, modalCol + 2, 'Ctrl+click ↗ to open in browser', { fg: Colors.textDim, bg: Colors.bgPanel })
    }

    // Save/cancel hint
    buf.write(modalRow + 7, modalCol + 2, '[Enter] Save    [Esc] Cancel', { fg: Colors.textDim, bg: Colors.bgPanel })
  }

  // ── Input handling ────────────────────────────────────────────────────────

  override onKey(e: KeyEvent): boolean {
    if (this.mode === 'edit')   return this.handleEditKey(e)
    if (this.mode === 'login')  return this.handleLoginKey(e)
    if (this.mode === 'import') return this.handleImportKey(e)
    return this.handleBrowseKey(e)
  }

  private handleLoginKey(e: KeyEvent): boolean {
    if (e.key === 'escape') { this.mode = 'browse'; this.onUpdate(); return true }
    return true  // consume all keys while login overlay is showing
  }

  private handleImportKey(e: KeyEvent): boolean {
    if (e.key === 'escape') { this.mode = 'browse'; this.onUpdate(); return true }
    if (e.key === 'enter' && this.importCandidates.length > 0) {
      for (const c of this.importCandidates) {
        const def = (PROVIDERS as readonly import('../../core/config/providers.js').ProviderDef[]).find(p => p.configKey === c.configKey && p.aliasOf === undefined)
        if (def) store.setKey(c.configKey, c.value, def.fieldType)
      }
      this.importCandidates = []
      this.mode = 'browse'
      this.onUpdate()
      return true
    }
    return true
  }

  private handleBrowseKey(e: KeyEvent): boolean {
    if (e.key === 'arrow_down') {
      this.moveSelection(1)
      this.onUpdate(); return true
    }
    if (e.key === 'arrow_up') {
      this.moveSelection(-1)
      this.onUpdate(); return true
    }
    if (e.key === 'page_down') {
      this.moveSelection(this.visibleListHeight())
      this.onUpdate(); return true
    }
    if (e.key === 'page_up') {
      this.moveSelection(-this.visibleListHeight())
      this.onUpdate(); return true
    }
    if (e.key === 'enter') {
      this.openEdit()
      this.onUpdate()
      return true
    }
    if (e.key === 'ctrl+r') {
      // Clear the selected entry's key (Ctrl+R = remove)
      const def = this.entries[this.selectedIdx]
      if (def && def.aliasOf === undefined) {
        const val = store.getKey(def.configKey)
        if (val !== undefined && val !== '') {
          store.clearKey(def.configKey)
          this.onUpdate()
          return true  // consumed — don't bubble to run-plan
        }
      }
      return false  // no value to clear — let app.ts handle run-plan
    }
    return false
  }

  private handleEditKey(e: KeyEvent): boolean {
    if (e.key === 'escape') {
      this.mode = 'browse'
      this.editBuf = ''
      this.onUpdate(); return true
    }
    if (e.key === 'enter') {
      const def = this.entries[this.selectedIdx]
      if (def && this.editBuf.length > 0) {
        store.setKey(def.configKey, this.editBuf, def.fieldType)
      }
      this.mode = 'browse'
      this.editBuf = ''
      this.onUpdate(); return true
    }
    if (e.key === 'backspace') {
      this.editBuf = this.editBuf.slice(0, -1)
      this.onUpdate(); return true
    }
    if (e.key.length === 1 && e.key >= ' ') {
      this.editBuf += e.key
      this.onUpdate(); return true
    }
    return false
  }

  override onMouse(e: MouseEvent): boolean {
    // Wheel convention: viewport offset ×1, never the selection (gap 1)
    if (e.button === 'scroll_up')   { this.scrollListBy(-1); this.onUpdate(); return true }
    if (e.button === 'scroll_down') { this.scrollListBy(1);  this.onUpdate(); return true }

    if (e.button !== 'left' || e.action !== 'press') return false

    // ── Login / Import overlays: click-outside dismisses, inside is consumed ─
    if (this.mode === 'login') {
      this.loginOverlay.handleMouse(e, this.loginOverlay.layout(this.inner, 9))
      return true
    }
    if (this.mode === 'import') {
      const contentRows = 6 + Math.max(1, this.importCandidates.length)
      this.importOverlay.handleMouse(e, this.importOverlay.layout(this.inner, contentRows))
      return true
    }

    // ── Auth header clicks (rows 0–1 of inner rect) ───────────────────────
    const r = this.inner
    const relRow = e.row - r.row
    if (relRow === 1) {
      const midCol = r.col + Math.floor(r.width / 2)
      if (e.col < midCol) {
        // Login / Logout button
        if (this.authUser) { this.callbacks.onLogout?.() }
        else               { this.callbacks.onLogin?.()  }
      } else {
        // Import button
        this.callbacks.onImport?.()
      }
      return true
    }

    // ── Edit modal intercepts all clicks when open ────────────────────────
    if (this.mode === 'edit') {
      const f = this.editOverlay.layout(this.inner, 8)

      // Click outside modal → cancel (standard Overlay dismissal)
      if (this.editOverlay.handleMouse(e, f)) return true

      // Click on button row (f.row + 7): left half = Save, right half = Cancel
      if (e.row === f.row + 7) {
        const midCol = f.col + Math.floor(f.width / 2)
        if (e.col < midCol) {
          // Save — same as Enter
          const def = this.entries[this.selectedIdx]
          if (def && this.editBuf.length > 0) {
            store.setKey(def.configKey, this.editBuf, def.fieldType)
          }
        }
        this.mode = 'browse'
        this.editBuf = ''
        this.onUpdate()
        return true
      }

      // Other clicks inside modal are consumed (no-op)
      return true
    }

    const listHeight = this.visibleListHeight()
    // clickRow is relative to the start of the scrollable list area (after header)
    const clickRow = e.row - (r.row + HEADER_ROWS)

    if (clickRow < 0 || clickRow >= listHeight) return false

    // Walk rendered rows to find which entry was clicked
    let rendered = 0
    for (let i = this.scrollTop; i < this.rows.length && rendered < listHeight; i++) {
      const item = this.rows[i]
      if (!item) { rendered++; continue }
      if (item.kind === 'header') {
        rendered += 2  // header + divider
        continue
      }
      if (rendered === clickRow) {
        const def = item.def
        // Click on [✕] delete button (last 3 cols) — clear key immediately
        if (def.aliasOf === undefined && e.col >= r.col + r.width - 3) {
          const val = store.getKey(def.configKey)
          if (val !== undefined && val !== '') {
            store.clearKey(def.configKey)
            this.onUpdate()
            return true
          }
        }
        // Alias row: jump to canonical provider
        if (def.aliasOf !== undefined) {
          const canonIdx = this.entries.findIndex(e => e.configKey === def.configKey && e.aliasOf === undefined)
          if (canonIdx >= 0) {
            this.selectedIdx = canonIdx
            this.syncScrollToSelected()
            this.onUpdate()
          }
          return true
        }

        const now = Date.now()
        const isDouble = item.entryIdx === this.lastClickEntryIdx &&
                         (now - this.lastClickTime) < DOUBLE_CLICK_MS
        this.lastClickEntryIdx = item.entryIdx
        this.lastClickTime = now

        this.selectedIdx = item.entryIdx
        if (isDouble) this.openEdit()
        this.onUpdate()
        return true
      }
      rendered++
    }
    return false
  }

  private openEdit(): void {
    const def = this.entries[this.selectedIdx]
    if (!def || def.aliasOf !== undefined) return
    this.editPrev = store.getKey(def.configKey, def.envVar) ?? ''
    this.editBuf  = ''
    this.mode = 'edit'
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private moveSelection(delta: number): void {
    const len = this.entries.length
    if (len === 0) return
    let next = this.selectedIdx + delta
    next = Math.max(0, Math.min(len - 1, next))
    // Skip alias entries in the direction of movement
    const step = delta > 0 ? 1 : -1
    while (next > 0 && next < len - 1 && this.entries[next]?.aliasOf !== undefined) {
      next += step
    }
    this.selectedIdx = next
    this.syncScrollToSelected()
  }

  /** Move the viewport window without touching the selection (wheel). */
  private scrollListBy(delta: number): void {
    const maxScroll = Math.max(0, this.rows.length - this.visibleListHeight())
    this.scrollTop = Math.max(0, Math.min(maxScroll, this.scrollTop + delta))
  }

  private syncScrollToSelected(): void {
    // Find the row index in this.rows[] that corresponds to selectedIdx
    let targetRowIdx = 0
    for (let i = 0; i < this.rows.length; i++) {
      const item = this.rows[i]
      if (item?.kind === 'entry' && item.entryIdx === this.selectedIdx) {
        targetRowIdx = i; break
      }
    }
    const listHeight = this.visibleListHeight()
    if (targetRowIdx < this.scrollTop) this.scrollTop = targetRowIdx
    if (targetRowIdx >= this.scrollTop + listHeight) this.scrollTop = targetRowIdx - listHeight + 1
  }

  private ensureVisible(listHeight: number): void {
    // Clamp scrollTop so we don't show empty space at the bottom
    const maxScroll = Math.max(0, this.rows.length - listHeight)
    this.scrollTop = Math.max(0, Math.min(this.scrollTop, maxScroll))
  }

  private visibleListHeight(): number {
    return this.inner.height - 2 - HEADER_ROWS
  }
}

// Re-export for tests
export { PROVIDERS, providersByCategory }
