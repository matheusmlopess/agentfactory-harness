import type { Panel } from '../tui/panels/Panel.js'
import type { PanelLayout, Rect } from '../tui/renderer/layout.js'
import type { TabId } from '../tui/tabs.js'
import type { PaletteCommand } from '../tui/widgets/CommandPalette.js'
import type { ConfigStore } from '../core/config/store.js'
import type { Tool } from '../core/tools/index.js'

/**
 * Services the host injects into features (docs/ddd/11-feature-isolation.md).
 * Kept deliberately minimal to avoid re-coupling; cross-feature services
 * register under `services` by name.
 */
export interface FeatureCtx {
  scheduleRender(): void
  render(): void
  store: ConfigStore
  layout(): PanelLayout
  showError(msg: string): void
  switchTab(id: TabId): void
  /** Cross-feature service registry (e.g. session bridge). */
  services: Map<string, unknown>
}

export interface KeyBindingContribution {
  id: string
  keys: string[]
  when?: TabId | 'global'
  description: string
  run(): void
}

/**
 * One feature = panel + commands + tools + keybindings, registered in one
 * place. The host iterates loadedFeatures() to build tabs, palette entries,
 * and (once the P4 keymap lands) key bindings — ending the "new panel
 * touches 8–10 places" problem (gaps 9, 10).
 */
export interface Feature {
  id: TabId | string
  tab?: {
    id: TabId
    title: string
    captureMouse: boolean
    rectFor(layout: PanelLayout): Rect
    hitVisible(activeId: TabId): boolean
    makePanel(ctx: FeatureCtx): Panel
  }
  commands?(ctx: FeatureCtx): PaletteCommand[]
  tools?: Tool[]
  keybindings?(ctx: FeatureCtx): KeyBindingContribution[]
  /** Lifecycle: called after the host is ready / on shutdown (heartbeats…). */
  start?(ctx: FeatureCtx): void
  stop?(): void
}
