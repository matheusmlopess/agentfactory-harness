/** Color palette and box-drawing character constants. */

export const Colors = {
  // Named 256-color indices
  bg:        232,  // near-black background
  bgPanel:   234,  // slightly lighter for panels
  bgActive:  236,  // active/focused panel
  border:    240,  // inactive border
  borderActive: 75, // focused border (blue)
  text:      252,  // default text
  textDim:   245,  // dim/secondary text
  textBright: 255, // bright text / headings
  accent:    75,   // blue accent
  success:   82,   // green
  warning:   214,  // orange
  error:     196,  // red
  info:      117,  // light blue
} as const

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
