import type { KeyEvent } from './keyboard.js'
import type { TabId } from '../tabs.js'

export interface KeyBindingDef {
  /** Stable id, e.g. 'app.quit'. */
  id: string
  /** Key names as produced by parseKey, e.g. ['ctrl+q'], ['j', 'arrow_down']. */
  keys: string[]
  /** Context filter: a tab id, or 'global' (default). */
  when?: TabId | 'global'
  /** Human description — feeds the help overlay. */
  description: string
  /**
   * Give the active panel first refusal: the binding only runs when the
   * panel does not consume the key (e.g. Ctrl+R = Config clear-key first,
   * run-plan otherwise).
   */
  panelFirst?: boolean
  run(): void
}

/**
 * Declarative, discoverable key bindings (gaps 1–4): the global if-chain
 * becomes data, contexts filter per tab, and the help overlay lists
 * everything. Single-printable-char bindings are suppressed while a text
 * input is active so typing never triggers actions.
 */
export class Keymap {
  private defs: KeyBindingDef[] = []

  add(defs: KeyBindingDef[]): void {
    for (const def of defs) {
      if (this.defs.some(d => d.id === def.id)) {
        throw new Error(`Duplicate keybinding id: ${def.id}`)
      }
      this.defs.push(def)
    }
  }

  /** The binding that would fire for this key in this context, if any. */
  match(key: KeyEvent, active: TabId, textInputActive: boolean): KeyBindingDef | null {
    for (const def of this.defs) {
      const context = def.when ?? 'global'
      if (context !== 'global' && context !== active) continue
      if (!def.keys.includes(key.key)) continue
      // Never steal printable characters from a text input
      const printable = key.key.length === 1 && key.key >= ' '
      if (printable && textInputActive) continue
      return def
    }
    return null
  }

  /** Handle a key in the given context. Returns true if a binding ran. */
  handle(key: KeyEvent, active: TabId, textInputActive: boolean): boolean {
    const def = this.match(key, active, textInputActive)
    if (!def) return false
    def.run()
    return true
  }

  /** Bindings visible in `active` context (global + tab), for the help overlay. */
  list(active?: TabId): KeyBindingDef[] {
    return this.defs.filter(d => {
      const context = d.when ?? 'global'
      return context === 'global' || active === undefined || context === active
    })
  }
}
