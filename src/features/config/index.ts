import { ConfigPanel } from '../../tui/panels/ConfigPanel.js'
import { getUser } from '../../registry/auth.js'
import { applySetting } from '../../tui/settings.js'
import { logger } from '../../core/logger.js'
import type { Feature, FeatureCtx } from '../types.js'
import { runLoginFlow, runLogout, runImport } from './flows.js'

const log = logger('ConfigFeature')

export function configFeature(): Feature {
  let panel: ConfigPanel | null = null

  return {
    id: 'config',
    tab: {
      id: 'config',
      title: 'Config',
      captureMouse: true,
      rectFor: l => l.config,
      hitVisible: a => a === 'config',
      makePanel(ctx: FeatureCtx) {
        panel = new ConfigPanel(ctx.layout().config, () => ctx.scheduleRender(), {
          onLogin:   () => { void runLoginFlow(ctx, panel!) },
          onLogout:  () => { void runLogout(ctx, panel!) },
          onImport:  () => { void runImport(ctx, panel!) },
          onSetting: (key, value) => { applySetting(ctx.store, key, value); ctx.render() },
        })
        return panel
      },
    },
    commands(ctx: FeatureCtx) {
      return [
        { id: 'login',  label: 'Login to AgentFactory',    hint: '', action: () => { if (panel) void runLoginFlow(ctx, panel) } },
        { id: 'logout', label: 'Logout from AgentFactory', hint: '', action: () => { if (panel) void runLogout(ctx, panel) } },
      ]
    },
    start(_ctx: FeatureCtx) {
      // Load registry auth user in background — don't block startup
      void getUser().then(user => {
        log.debug('auth user loaded', { isLoggedIn: user !== null })
        panel?.setAuthUser(user)
      })
    },
  }
}

/** True while the config key-edit modal has a text input focused. */
export function configEditing(panel: unknown): boolean {
  return panel instanceof ConfigPanel && panel.isEditing
}
