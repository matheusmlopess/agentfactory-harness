import type { Panel } from './panel.js'
import type { PanelLayout, Rect } from './renderer/layout.js'

/** Stable tab identifiers — replaces the TAB_* index constants (gap 10). */
export type TabId = 'session' | 'orchestration' | 'agents' | 'terminal' | 'config' | 'logs'

export const TAB_ORDER: readonly TabId[] = [
  'session', 'orchestration', 'agents', 'terminal', 'config', 'logs',
]

export interface TabEntry {
  id: TabId
  title: string
  /** Panel accessor — lazy for panels that spawn resources (Terminal PTY). */
  panel(): Panel
  rectFor(layout: PanelLayout): Rect
  /**
   * Whether this tab's rect participates in mouse hit-scanning while
   * `activeId` is the active tab. Reproduces the historical panelTabAt
   * branch semantics exactly (session always; config/terminal only while
   * active; canvas+agents otherwise).
   */
  hitVisible(activeId: TabId): boolean
  /**
   * Capture-mode tabs receive ALL mouse events while active (Config, Logs)
   * instead of participating in the rect scan.
   */
  captureMouse: boolean
  /** Called by the host just before rendering this tab's panel each frame. */
  beforeRender?: () => void
}

export function tabIndex(id: TabId): number {
  return TAB_ORDER.indexOf(id)
}

export function tabIdAt(index: number): TabId {
  return TAB_ORDER[((index % TAB_ORDER.length) + TAB_ORDER.length) % TAB_ORDER.length]!
}
