import type { KeyEvent } from './keyboard.js'
import type { MouseEvent } from './mouse.js'
import type { TabEntry, TabId } from '../tabs.js'
import { rectContains } from './hit-test.js'

/**
 * Unified event routing over the tab list (gap 10). All six tabs are
 * first-class targets — the historical tab-index vs panels[]-index mismatch
 * (Config=4, Logs=5 explicit dispatch) is gone.
 */
export class InputRouter {
  /** Keys go to the active tab's panel. */
  dispatchKey(e: KeyEvent, tabs: readonly TabEntry[], activeId: TabId): boolean {
    const tab = tabs.find(t => t.id === activeId)
    return tab ? tab.panel().onKey(e) : false
  }

  /**
   * Mouse events go to the first hit-visible panel whose rect contains the
   * point. Capture-mode tabs (Config, Logs) are handled by the controller
   * before this scan.
   */
  dispatchMouse(e: MouseEvent, tabs: readonly TabEntry[], activeId: TabId): boolean {
    for (const tab of tabs) {
      if (tab.captureMouse || !tab.hitVisible(activeId)) continue
      const p = tab.panel()
      if (rectContains(p.rect, e.row, e.col)) return p.onMouse(e)
    }
    return false
  }

  /** Tab whose visible rect contains (row, col) — click-to-focus target. */
  tabAt(row: number, col: number, tabs: readonly TabEntry[], activeId: TabId): TabId | null {
    for (const tab of tabs) {
      if (!tab.hitVisible(activeId)) continue
      if (rectContains(tab.panel().rect, row, col)) return tab.id
    }
    return null
  }
}
