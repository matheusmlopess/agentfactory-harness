import type { ConfigStore } from '@factory/core/config/store.js'
import { setTheme } from './renderer/theme.js'
import { refreshMotionSetting } from './renderer/motion.js'

/** Apply + persist a UI setting, refreshing dependent subsystems. */
export function applySetting(store: ConfigStore, key: string, value: string): void {
  store.setSetting(key, value)
  if (key === 'theme') setTheme(value === 'high-contrast' ? 'high-contrast' : 'default')
  if (key === 'reducedMotion') refreshMotionSetting()
}
