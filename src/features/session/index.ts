import { SessionPanel, type SessionStats } from './panel.js'
import * as A from '@factory/shared/renderer/ansi.js'
import type { Feature, FeatureCtx, SessionBridge } from '@factory/contracts/index.js'
import { CONTRACT_VERSION } from '@factory/contracts/index.js'

// Back-compat: SessionBridge/SessionMeta are now defined in contracts/session
// panel; re-export so existing importers keep resolving.
export type { SessionBridge } from '@factory/contracts/index.js'
export type { SessionMeta } from './panel.js'

export function sessionFeature(): Feature {
  let panel: SessionPanel | null = null

  return {
    id: 'session',
    manifest: { id: 'session', contract: CONTRACT_VERSION, provides: ['session'] },
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
