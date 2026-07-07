import type { ConfigPanel } from './panel.js'
import { startDeviceLogin } from '../../registry/login.js'
import { clearToken } from '../../registry/auth.js'
import { importFromTools } from '../../registry/import-keys.js'
import type { FeatureCtx } from '../types.js'

/** Device-code login flow — drives the ConfigPanel login overlay. */
export async function runLoginFlow(ctx: FeatureCtx, panel: ConfigPanel): Promise<void> {
  ctx.switchTab('config')
  for await (const ev of startDeviceLogin()) {
    panel.updateLoginEvent(ev)
    ctx.render()
    if (ev.kind === 'success' || ev.kind === 'error') break
  }
}

export async function runLogout(ctx: FeatureCtx, panel: ConfigPanel): Promise<void> {
  await clearToken()
  panel.setAuthUser(null)
  ctx.render()
}

export async function runImport(ctx: FeatureCtx, panel: ConfigPanel): Promise<void> {
  const candidates = await importFromTools()
  panel.showImportCandidates(candidates)
  ctx.render()
}
