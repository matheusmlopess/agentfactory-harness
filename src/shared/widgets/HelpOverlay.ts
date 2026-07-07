import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import type { KeyEvent } from '../input/keyboard.js'
import type { MouseEvent } from '../input/mouse.js'
import type { Keymap } from '../input/keymap.js'
import type { TabId } from '../tabs.js'
import { Overlay } from './Overlay.js'
import { ScrollableList, type ListRow } from './ScrollableList.js'
import { Colors } from '../renderer/theme.js'

const VISIBLE_ROWS = 14

/**
 * `?` keyboard-shortcut reference (gap: discoverability). Lists the keymap
 * grouped Global / current tab; scrollable; standard Esc/click dismissal.
 */
export class HelpOverlay {
  private readonly overlay: Overlay
  private readonly list = new ScrollableList({ visibleRows: VISIBLE_ROWS })
  private openState = false

  constructor(private readonly keymap: Keymap, private readonly onClose: () => void) {
    this.overlay = new Overlay({
      title: 'Keyboard Shortcuts', tier: 'lg', footerHint: 'Esc close',
      onDismiss: () => this.close(),
    })
  }

  get isOpen(): boolean { return this.openState }

  open(active: TabId): void {
    this.openState = true
    const rows: ListRow[] = []
    const defs = this.keymap.list(active)
    const globals = defs.filter(d => (d.when ?? 'global') === 'global')
    const scoped = defs.filter(d => (d.when ?? 'global') !== 'global')

    rows.push({ text: ' Global', header: true })
    for (const d of globals) rows.push({ text: ` ${d.keys.join(' / ').padEnd(16)} ${d.description}` })
    if (scoped.length > 0) {
      rows.push({ text: ` ${active[0]!.toUpperCase()}${active.slice(1)} tab`, header: true })
      for (const d of scoped) rows.push({ text: ` ${d.keys.join(' / ').padEnd(16)} ${d.description}` })
    }
    this.list.setRows(rows)
  }

  private close(): void {
    this.openState = false
    this.onClose()
  }

  private contentRows(): number {
    return Math.min(this.list.rowCount, VISIBLE_ROWS) + (this.list.isScrollable ? 1 : 0)
  }

  render(buf: CellBuffer, container: Rect): void {
    if (!this.openState) return
    const f = this.overlay.renderFrame(buf, container, this.contentRows())
    this.list.render(buf, f.inner.row, f.inner.col, f.inner.width)
    const hint = this.list.scrollHint()
    if (hint) {
      buf.write(f.inner.row + Math.min(this.list.rowCount, VISIBLE_ROWS), f.inner.col,
        hint.substring(0, f.inner.width), { fg: Colors.textDim, bg: Colors.surfacePanel })
    }
  }

  /** Returns true if the key was consumed. */
  onKey(e: KeyEvent): boolean {
    if (!this.openState) return false
    if (this.overlay.handleKey(e)) return true
    if (e.key === 'arrow_up')   { this.list.moveUp(); return true }
    if (e.key === 'arrow_down') { this.list.moveDown(); return true }
    return true  // modal: consume everything while open
  }

  /** Returns true if the event was consumed. */
  onMouse(e: MouseEvent, container: Rect): boolean {
    if (!this.openState) return false
    if (e.button === 'scroll_up')   { this.list.onWheel('up'); return true }
    if (e.button === 'scroll_down') { this.list.onWheel('down'); return true }
    const f = this.overlay.layout(container, this.contentRows())
    this.overlay.handleMouse(e, f)
    return true
  }
}
