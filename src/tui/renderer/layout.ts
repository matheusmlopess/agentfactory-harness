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
  statusBar: Rect
}

/**
 * Compute panel rects from terminal dimensions.
 *
 * Layout:
 *   row 0         : tab bar (1 row)
 *   rows 1..H-2   : main area (split: session left 40%, right column 60%)
 *   row H-1       : status bar (1 row)
 *
 * Right column (tabs 1-2): canvas top 70%, agents bottom 30%
 * Right column (tab 3):    terminal fills full right column
 */
export function computeLayout(rows: number, cols: number): PanelLayout {
  const sessionWidth = Math.floor(cols * 0.4)
  const rightWidth = cols - sessionWidth
  const mainHeight = rows - 2   // minus tabBar + statusBar
  const canvasHeight = Math.floor(mainHeight * 0.7)
  const agentsHeight = mainHeight - canvasHeight

  return {
    tabBar:    { row: 0, col: 0, height: 1, width: cols },
    session:   { row: 1, col: 0, height: mainHeight, width: sessionWidth },
    canvas:    { row: 1, col: sessionWidth, height: canvasHeight, width: rightWidth },
    agents:    { row: 1 + canvasHeight, col: sessionWidth, height: agentsHeight, width: rightWidth },
    terminal:  { row: 1, col: sessionWidth, height: mainHeight, width: rightWidth },
    config:    { row: 1, col: sessionWidth, height: mainHeight, width: rightWidth },
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
  const borderColor = focused ? Colors.borderActive : Colors.border
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

  // Title inline in top border
  if (title) {
    const label = ` ${title} `
    buf.write(row, col + 2, label, { fg: Colors.textBright, bold: focused })
  }
}
