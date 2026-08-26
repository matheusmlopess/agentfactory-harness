import { store } from '@factory/core/config/store.js'

let cached: boolean | null = null

/**
 * Reduced-motion preference (gap 19). When motion is disabled, spinners and
 * countdown tickers render a static glyph + text instead of animating.
 */
export function motionEnabled(): boolean {
  if (cached === null) cached = store.getSetting('reducedMotion') !== 'true'
  return cached
}

/** Called when the setting changes (Config UI / palette command). */
export function refreshMotionSetting(): void {
  cached = null
}
