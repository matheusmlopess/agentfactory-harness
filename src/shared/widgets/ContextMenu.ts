import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { KeyEvent } from '../input/keyboard.js'
import type { MouseEvent } from '../input/mouse.js'
import { Colors } from '../renderer/theme.js'

export interface MenuItem {
  label: string
  action: () => void
  danger?: boolean
}

export class ContextMenu {
  private row: number
  private col: number
  private items: MenuItem[]
  private selectedIdx = 0
  private lastW = 0
  private lastH = 0

  constructor(row: number, col: number, items: MenuItem[], private readonly onDismiss?: () => void) {
    this.row = row
    this.col = col
    this.items = items
  }

  render(buf: CellBuffer, maxRows: number, maxCols: number): void {
    const menuWidth = Math.max(4, Math.min(
      Math.max(...this.items.map(i => i.label.length)) + 4,
      maxCols - this.col
    ))
    const menuHeight = Math.max(3, Math.min(this.items.length + 2, maxRows - this.row))
    this.lastW = menuWidth
    this.lastH = menuHeight

    // Border
    buf.write(this.row, this.col, '┌' + '─'.repeat(menuWidth - 2) + '┐', { fg: Colors.border })
    buf.write(this.row + menuHeight - 1, this.col, '└' + '─'.repeat(menuWidth - 2) + '┘', { fg: Colors.border })
    for (let r = 1; r < menuHeight - 1; r++) {
      buf.write(this.row + r, this.col, '│', { fg: Colors.border })
      buf.fill(this.row + r, this.col + 1, 1, menuWidth - 2, ' ', { bg: Colors.surfaceActive })
      buf.write(this.row + r, this.col + menuWidth - 1, '│', { fg: Colors.border })
    }

    // Items
    for (let i = 0; i < this.items.length && i + 1 < menuHeight - 1; i++) {
      const item = this.items[i]
      if (!item) continue
      const selected = i === this.selectedIdx
      const fg = item.danger
        ? Colors.danger
        : selected ? Colors.surface : Colors.text
      const bg = selected ? Colors.primary : Colors.surfaceActive
      const label = ` ${item.label}`.padEnd(menuWidth - 2).substring(0, menuWidth - 2)
      buf.write(this.row + 1 + i, this.col + 1, label, { fg, bg })
    }
  }

  onKey(e: KeyEvent): boolean {
    if (e.key === 'escape') {
      this.onDismiss?.()
      return true
    }
    if (e.key === 'arrow_up') {
      this.selectedIdx = Math.max(0, this.selectedIdx - 1)
      return true
    }
    if (e.key === 'arrow_down') {
      this.selectedIdx = Math.min(this.items.length - 1, this.selectedIdx + 1)
      return true
    }
    if (e.key === 'enter') {
      const item = this.items[this.selectedIdx]
      if (item) item.action()
      return true
    }
    return false
  }

  /**
   * Mouse convention (gap 4): left-press on an item activates it; any other
   * left-press dismisses. Requires a prior render() for geometry.
   */
  onMouse(e: MouseEvent): boolean {
    if (e.button !== 'left' || e.action !== 'press') return false
    const inside =
      e.row >= this.row && e.row < this.row + this.lastH &&
      e.col >= this.col && e.col < this.col + this.lastW
    if (inside) {
      const itemIdx = e.row - (this.row + 1)
      const item = itemIdx >= 0 && itemIdx + 1 < this.lastH - 1 ? this.items[itemIdx] : undefined
      if (item) {
        this.selectedIdx = itemIdx
        item.action()
        return true
      }
    }
    this.onDismiss?.()
    return true
  }
}
