import { SessionPanel, type SessionStats } from '../../tui/panels/SessionPanel.js'
import * as A from '../../tui/renderer/ansi.js'
import type { ModelEntry } from '../../core/llm/index.js'
import type { Feature, FeatureCtx } from '../types.js'

/**
 * Cross-feature surface of the session feature (registered under
 * services key 'session'). StatusBar chrome, the input controller, and the
 * agents dashboard consume it — keeping FeatureCtx itself minimal (ddd/11).
 */
export interface SessionBridge {
  metas(): ReturnType<SessionPanel['sessionMetas']>
  switchTo(idx: number): void
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
