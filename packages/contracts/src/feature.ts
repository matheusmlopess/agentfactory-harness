/**
 * The Feature plugin contract (docs/ddd/11-feature-isolation.md).
 *
 * A feature = panel + commands + tools + keybindings + lifecycle, registered in
 * one place. The host iterates loadedFeatures() to build tabs, palette entries,
 * and key bindings. Shared/core references are `import type` only (erased).
 */
import type { Panel } from '@factory/shared/panel.js'
import type { PanelLayout, Rect } from '@factory/shared/renderer/layout.js'
import type { TabId } from '@factory/shared/tabs.js'
import type { PaletteCommand } from '@factory/shared/widgets/CommandPalette.js'
import type { KeyBindingDef } from '@factory/shared/input/keymap.js'
import type { ConfigStore } from '@factory/core/config/store.js'
import type { Tool } from '@factory/core/tools/index.js'
import type { ServiceRegistry } from './services.js'
import type { FeatureManifest } from './manifest.js'

/**
 * Services the host injects into features. Kept deliberately minimal to avoid
 * re-coupling; cross-feature capabilities go through the typed `services`
 * registry (see contracts/services.ts), never a direct sibling import.
 */
export interface FeatureCtx {
  scheduleRender(): void
  render(): void
  store: ConfigStore
  layout(): PanelLayout
  showError(msg: string): void
  switchTab(id: TabId): void
  /** Typed cross-feature service registry (ServiceMap-keyed). */
  services: ServiceRegistry
}

/** Feature keybindings share the keymap's binding shape. */
export type KeyBindingContribution = KeyBindingDef

export interface Feature {
  id: TabId | string
  /** Optional runtime manifest — enables config toggles + contract-version
   *  gating (Stage E). Absent = always loaded at the host's contract version. */
  manifest?: FeatureManifest
  tab?: {
    id: TabId
    title: string
    captureMouse: boolean
    rectFor(layout: PanelLayout): Rect
    hitVisible(activeId: TabId): boolean
    /** Called lazily on first access — a PTY-backed panel spawns only then. */
    makePanel(ctx: FeatureCtx): Panel
    /** Called by the host just before rendering this tab's panel each frame. */
    beforeRender?(): void
  }
  commands?(ctx: FeatureCtx): PaletteCommand[]
  tools?: Tool[]
  keybindings?(ctx: FeatureCtx): KeyBindingContribution[]
  /** Lifecycle: called after the host is ready / on shutdown (heartbeats…). */
  start?(ctx: FeatureCtx): void
  stop?(): void
}
