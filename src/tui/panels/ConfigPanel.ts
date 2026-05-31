import { Panel } from './Panel.js'
import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import type { KeyEvent } from '../input/keyboard.js'
import type { MouseEvent } from '../input/mouse.js'
import { Colors } from '../renderer/theme.js'
import { store } from '../../core/config/store.js'
import { providersByCategory, PROVIDERS } from '../../core/config/providers.js'
import type { ProviderDef, Category } from '../../core/config/providers.js'

type PanelMode = 'browse' | 'edit'

// A rendered row is either a category header or a provider entry
type RowItem = { kind: 'header'; category: Category } | { kind: 'entry'; def: ProviderDef; entryIdx: number }

const CATEGORY_LABELS: Record<Category, string> = {
  api:       'API Providers',
  cli:       'CLI Tools',
  ide:       'IDE / Editor',
  framework: 'Agent Frameworks',
  local:     'Local Models',
}

function maskValue(val: string, def: ProviderDef): string {
  if (def.fieldType === 'url') return val  // URLs shown unmasked
  if (val.length === 0) return ''
  // Show first few chars before the first meaningful delimiter, then mask
  const dashIdx = val.indexOf('-', 3)
  const prefix = dashIdx > 0 ? val.slice(0, dashIdx + 1) : val.slice(0, Math.min(6, val.length))
  return `${prefix}…▓▓▓▓`
}

const DOUBLE_CLICK_MS = 350

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

  constructor(rect: Rect, onUpdate: () => void) {
    super(rect)
    this.onUpdate = onUpdate

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

  // ── Rendering ────────────────────────────────────────────────────────────

  override render(buf: CellBuffer): void {
    const r = this.inner
    if (r.height < 4 || r.width < 20) return

    // List always uses full height; modal floats on top when editing
    const listHeight = r.height - 2

    // Fill background
    buf.fill(r.row, r.col, r.height, r.width, ' ', { bg: Colors.bgPanel })

    // ── Provider list ──────────────────────────────────────────────────────
    this.ensureVisible(listHeight)

    let screenRow = r.row
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

        const valCol = r.width - nameCol
        let valStr: string
        if (isAlias) {
          valStr = `(→ ${def.aliasOf})`
        } else {
          const val = store.getKey(def.configKey, def.envVar)
          valStr = (val !== undefined && val !== '') ? `${maskValue(val, def)} [set]` : '(not set)'
        }
        const valFg = isAlias ? Colors.textDim : (store.getKey(def.configKey, def.envVar) ? Colors.success : Colors.textDim)
        buf.write(screenRow, r.col + nameCol, valStr.substring(0, valCol - 1).padStart(valCol - 1), { fg: valFg, bg: nameBg })

        screenRow++; rowsRendered++
      }
      rowIdx++
    }

    // ── Scroll indicators ─────────────────────────────────────────────────
    if (this.rows.length > rowsRendered) {
      if (this.scrollTop > 0)       buf.write(r.row, r.col + r.width - 3, ' ▲ ', { fg: Colors.textDim, bg: Colors.bgPanel })
      if (rowIdx < this.rows.length) buf.write(r.row + listHeight - 1, r.col + r.width - 3, ' ▼ ', { fg: Colors.textDim, bg: Colors.bgPanel })
    }

    // ── Hint bar (browse mode) ────────────────────────────────────────────
    if (this.mode === 'browse') {
      const hintRow = r.row + r.height - 2
      buf.write(hintRow, r.col, '─'.repeat(r.width), { fg: Colors.border, bg: Colors.bgPanel })
      const hint = ' [↑↓/scroll] Navigate  [Enter/DblClick] Edit  [PgUp/PgDn] Scroll'
      buf.write(hintRow + 1, r.col, hint.substring(0, r.width), { fg: Colors.textDim, bg: Colors.bgPanel })
    }

    // ── Edit modal overlay ────────────────────────────────────────────────
    if (this.mode === 'edit') {
      const def = this.entries[this.selectedIdx]
      if (!def) return
      this.renderEditModal(buf, r, def)
    }

    // ── Write error if last persist failed ────────────────────────────────
    if (store.lastWriteError) {
      buf.write(r.row + r.height - 1, r.col, ` ⚠ ${store.lastWriteError} `.substring(0, r.width), { fg: Colors.bg, bg: Colors.error })
    }
  }

  private renderEditModal(buf: CellBuffer, r: { row: number; col: number; height: number; width: number }, def: ProviderDef): void {
    const modalW = Math.min(r.width - 4, 56)
    const modalH = 10
    const modalRow = r.row + Math.floor((r.height - modalH) / 2)
    const modalCol = r.col + Math.floor((r.width - modalW) / 2)

    // Dim area behind modal
    buf.fill(modalRow, modalCol, modalH, modalW, ' ', { bg: Colors.bgPanel })

    // Border
    const hLine = '─'.repeat(modalW - 2)
    buf.write(modalRow,           modalCol, '┌' + hLine + '┐', { fg: Colors.borderActive, bg: Colors.bgPanel })
    buf.write(modalRow + modalH - 1, modalCol, '└' + hLine + '┘', { fg: Colors.borderActive, bg: Colors.bgPanel })
    for (let i = 1; i < modalH - 1; i++) {
      buf.write(modalRow + i, modalCol, '│', { fg: Colors.borderActive, bg: Colors.bgPanel })
      buf.write(modalRow + i, modalCol + modalW - 1, '│', { fg: Colors.borderActive, bg: Colors.bgPanel })
      buf.fill(modalRow + i, modalCol + 1, 1, modalW - 2, ' ', { bg: Colors.bgPanel })
    }

    // Title in top border
    const titleStr = ` Configure: ${def.name} `
    buf.write(modalRow, modalCol + 2, titleStr.substring(0, modalW - 4), { fg: Colors.textBright, bg: Colors.bgPanel, bold: true })

    // Field label (env var or config key)
    const fieldLabel = def.envVar ?? def.configKey.toUpperCase()
    buf.write(modalRow + 2, modalCol + 2, fieldLabel.substring(0, modalW - 4), { fg: Colors.accent, bg: Colors.bgPanel, bold: true })

    // Format hint
    buf.write(modalRow + 3, modalCol + 2, `Format: ${def.hint}`.substring(0, modalW - 4), { fg: Colors.textDim, bg: Colors.bgPanel })

    // Input field
    const prompt = '  > '
    const cursor = '█'
    const fieldW = modalW - prompt.length - 3
    const inputDisplay = this.editBuf.length > fieldW ? this.editBuf.slice(-fieldW) + cursor : this.editBuf + cursor
    const inputLine = (prompt + inputDisplay).substring(0, modalW - 2).padEnd(modalW - 2)
    buf.write(modalRow + 5, modalCol + 1, inputLine, { fg: Colors.text, bg: Colors.bgActive })

    // Save/cancel hint
    buf.write(modalRow + 7, modalCol + 2, '[Enter] Save    [Esc] Cancel', { fg: Colors.textDim, bg: Colors.bgPanel })
  }

  // ── Input handling ────────────────────────────────────────────────────────

  override onKey(e: KeyEvent): boolean {
    if (this.mode === 'edit') return this.handleEditKey(e)
    return this.handleBrowseKey(e)
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
    // Scroll wheel — navigate selection like arrow keys
    if (e.button === 'scroll_up')   { this.moveSelection(-1); this.onUpdate(); return true }
    if (e.button === 'scroll_down') { this.moveSelection(1);  this.onUpdate(); return true }

    if (e.button !== 'left' || e.action !== 'press') return false

    // ── Edit modal intercepts all clicks when open ────────────────────────
    if (this.mode === 'edit') {
      const r = this.inner
      const modalW   = Math.min(r.width - 4, 56)
      const modalH   = 10
      const modalRow = r.row + Math.floor((r.height - modalH) / 2)
      const modalCol = r.col + Math.floor((r.width  - modalW) / 2)
      const modalEndRow = modalRow + modalH - 1
      const modalEndCol = modalCol + modalW - 1

      // Click outside modal → cancel
      if (e.row < modalRow || e.row > modalEndRow || e.col < modalCol || e.col > modalEndCol) {
        this.mode = 'browse'
        this.editBuf = ''
        this.onUpdate()
        return true
      }

      // Click on button row (modalRow + 7): left half = Save, right half = Cancel
      if (e.row === modalRow + 7) {
        const midCol = modalCol + Math.floor(modalW / 2)
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

    const r = this.inner
    const listHeight = this.visibleListHeight()
    const clickRow = e.row - r.row

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
    return this.inner.height - 2
  }
}

// Re-export for tests
export { PROVIDERS, providersByCategory }
