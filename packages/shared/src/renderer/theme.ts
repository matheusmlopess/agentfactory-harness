/** Semantic theme tokens + box-drawing character constants. */

/**
 * Semantic color tokens (gap 18). `focus` and `primary` are distinct tokens —
 * they share a value in the default theme but diverge in high-contrast.
 */
export interface Theme {
  surface: number        // app background
  surfacePanel: number   // panel background
  surfaceActive: number  // active/focused panel background
  border: number         // inactive border
  focus: number          // focused border / focus indicator
  primary: number        // brand accent (tabs, selection)
  text: number
  textDim: number
  textBright: number
  success: number
  warning: number
  danger: number
  info: number
}

export type ThemeName = 'default' | 'high-contrast'

export const themes: Record<ThemeName, Theme> = {
  default: {
    surface: 232,        // near-black background
    surfacePanel: 234,   // slightly lighter for panels
    surfaceActive: 236,  // active/focused panel
    border: 240,         // inactive border
    focus: 75,           // focused border (blue)
    primary: 75,         // blue accent
    text: 252,
    textDim: 245,
    textBright: 255,
    success: 82,         // green
    warning: 214,        // orange
    danger: 196,         // red
    info: 117,           // light blue
  },
  'high-contrast': {
    surface: 16,         // pure black
    surfacePanel: 16,
    surfaceActive: 232,
    border: 255,         // white borders
    focus: 226,          // yellow focus — distinct from primary
    primary: 51,         // bright cyan
    text: 231,           // pure white
    textDim: 250,
    textBright: 231,
    success: 46,
    warning: 220,
    danger: 196,
    info: 87,
  },
}

/**
 * Live token view. Panels reference `Colors.<token>` directly; `setTheme`
 * swaps the values in place so the next render picks up the new theme
 * without any call-site changes.
 */
export const Colors: Theme = { ...themes.default }

let active: ThemeName = 'default'

export function setTheme(name: ThemeName): void {
  active = name
  Object.assign(Colors, themes[name])
}

export function activeTheme(): ThemeName {
  return active
}

/** Box-drawing chars for single-line borders */
export const Box = {
  tl: '┌', tr: '┐', bl: '└', br: '┘',
  h: '─', v: '│',
  tee_r: '├', tee_l: '┤', tee_d: '┬', tee_u: '┴',
  cross: '┼',
} as const

/** Box-drawing chars for double-line borders (ITUI blocks) */
export const DBox = {
  tl: '╔', tr: '╗', bl: '╚', br: '╝',
  h: '═', v: '║',
  tee_r: '╠', tee_l: '╣', tee_d: '╦', tee_u: '╩',
  cross: '╬',
} as const

/** Wire routing chars */
export const Wire = {
  h: '─', v: '│',
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  arrowR: '►', arrowD: '▼',
  portIn: '●', portOut: '○',
} as const

/** Status indicators */
export const Status = {
  idle:    '○',
  running: '⏳',
  done:    '✓',
  error:   '✗',
} as const
