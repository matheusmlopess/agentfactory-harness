import { SessionPanel, type SessionStats, type SessionMeta } from './panel.js'
import * as A from '../../shared/renderer/ansi.js'
import type { ModelEntry } from '../../core/llm/index.js'
import type { Feature, FeatureCtx } from '../types.js'

export type { SessionMeta } from './panel.js'

/**
 * Cross-feature surface of the session feature (registered under
 * services key 'session'). StatusBar chrome, the input controller, the
 * agents dashboard, and the canvas consume it — keeping FeatureCtx itself
 * minimal (ddd/11).
 */
export interface SessionBridge {
  metas(): SessionMeta[]
  switchTo(idx: number): void
  /** Activate the loaded session with this id; false if it isn't loaded. */
  switchToId(id: string): boolean
  /** Create a named session without stealing focus (canvas node binding). */
  createSession(name: string, model?: ModelEntry | null): SessionMeta
  /** Resume a saved rollout by id; returns the NEW record's meta or null. */
  resumeById(id: string): SessionMeta | null
  /** Post a user message to a session and resolve with the assistant text. */
  postMessage(id: string, text: string): Promise<string>
  getSelectedModel(): ModelEntry | null
  getChatMode(): boolean
  toggleChatMode(): void
  openModelPicker(): void
  openNewSessionMenu(): void
  hasSelection(): boolean
  copySelection(): void
  clearSelection(): void
}

export function sessionFeature(): Feature {
  let panel: SessionPanel | null = null

  return {
    id: 'session',
    tab: {
      id: 'session',
      title: 'Session',
      captureMouse: false,
      rectFor: l => l.session,
      hitVisible: () => true,
      makePanel(ctx: FeatureCtx) {
        panel = new SessionPanel(ctx.layout().session, () => ctx.scheduleRender(),
          (_s: SessionStats) => { ctx.scheduleRender() },               // onStats: records hold state; just repaint
          (target) => { if (target === 'config') ctx.switchTab('config') },
          (text) => { process.stdout.write(A.osc52Copy(text)) },        // onCopy via OSC 52
        )
        const bridge: SessionBridge = {
          metas: () => panel!.sessionMetas(),
          switchTo: (idx) => panel!.switchTo(idx),
          switchToId: (id) => panel!.switchToId(id),
          createSession: (name, model) => panel!.createSession(name, model ?? null),
          resumeById: (id) => panel!.resumeById(id),
          postMessage: (id, text) => panel!.postMessage(id, text),
          getSelectedModel: () => panel!.getSelectedModel(),
          getChatMode: () => panel!.getChatMode(),
          toggleChatMode: () => panel!.toggleChatMode(),
          openModelPicker: () => panel!.openModelPicker(),
          openNewSessionMenu: () => panel!.openNewSessionMenu(),
          hasSelection: () => panel!.hasSelection(),
          copySelection: () => panel!.copySelection(),
          clearSelection: () => panel!.clearSelection(),
        }
        ctx.services.set('session', bridge)
        return panel
      },
    },
    commands(ctx: FeatureCtx) {
      return [
        { id: 'clear-session', label: 'Clear Session', hint: '', action: () => { panel?.clearSession(); ctx.render() } },
      ]
    },
  }
}
