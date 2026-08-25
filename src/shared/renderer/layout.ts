import { CellBuffer } from './cell-buffer.js'
import { Colors, Box } from './theme.js'

export interface Rect {
  row: number
  col: number
  height: number
  width: number
}

export interface PanelLayout {
  tabBar: Rect
  session: Rect
  canvas: Rect
  agents: Rect
  terminal: Rect
  config: Rect
  logs: Rect
  statusBar: Rect
}

export interface LayoutPrefs {
  /** Session column share of total width; clamped to [0.25, 0.6]. Default 0.4. */
  sessionRatio?: number
  /** Canvas share of the right column height; clamped to [0.4, 0.85]. Default 0.7. */
  canvasRatio?: number
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * Compute panel rects from terminal dimensions.
 *
 * Layout:
 *   row 0         : tab bar (1 row)
 *   rows 1..H-2   : main area (split: session left, right column)
 *   row H-1       : status bar (1 row)
 *
 * Right column (tabs 1-2): canvas top / agents bottom
 * Right column (tab 3):    terminal fills full right column
 *
 * Split ratios default to the historical 40% / 70-30 and are adjustable via
 * prefs (draggable dividers, gap 20).
 */
export function computeLayout(rows: number, cols: number, prefs: LayoutPrefs = {}): PanelLayout {
  const sessionRatio = clamp(prefs.sessionRatio ?? 0.4, 0.25, 0.6)
  const canvasRatio = clamp(prefs.canvasRatio ?? 0.7, 0.4, 0.85)
  const sessionWidth = Math.floor(cols * sessionRatio)
  const rightWidth = cols - sessionWidth
  const mainHeight = rows - 2   // minus tabBar + statusBar
  const canvasHeight = Math.floor(mainHeight * canvasRatio)
  const agentsHeight = mainHeight - canvasHeight

  return {
    tabBar:    { row: 0, col: 0, height: 1, width: cols },
    session:   { row: 1, col: 0, height: mainHeight, width: sessionWidth },
    canvas:    { row: 1, col: sessionWidth, height: canvasHeight, width: rightWidth },
    agents:    { row: 1 + canvasHeight, col: sessionWidth, height: agentsHeight, width: rightWidth },
    terminal:  { row: 1, col: sessionWidth, height: mainHeight, width: rightWidth },
    config:    { row: 1, col: sessionWidth, height: mainHeight, width: rightWidth },
    logs:      { row: 1, col: 0, height: mainHeight, width: cols },
    statusBar: { row: rows - 1, col: 0, height: 1, width: cols },
  }
}

/** Draw a single-line border box into the buffer. */
export function drawBorder(
  buf: CellBuffer,
  rect: Rect,
  title = '',
  focused = false
): void {
  const { row, col, height, width } = rect
  const borderColor = focused ? Colors.focus : Colors.border
  const style = { fg: borderColor }

  // Corners
  buf.write(row, col, Box.tl, style)
  buf.write(row, col + width - 1, Box.tr, style)
  buf.write(row + height - 1, col, Box.bl, style)
  buf.write(row + height - 1, col + width - 1, Box.br, style)

  // Top/bottom edges
  const hLine = Box.h.repeat(width - 2)
  buf.write(row, col + 1, hLine, style)
  buf.write(row + height - 1, col + 1, hLine, style)

  // Side edges
  for (let r = row + 1; r < row + height - 1; r++) {
    buf.write(r, col, Box.v, style)
    buf.write(r, col + width - 1, Box.v, style)
  }

  // Title inline in top border — focused panels get inverse-video bold so
  // focus is legible without color (a11y, gap 18)
  if (title) {
    const label = ` ${title} `
    buf.write(row, col + 2, label, { fg: Colors.textBright, bold: focused, reverse: focused })
  }
}
