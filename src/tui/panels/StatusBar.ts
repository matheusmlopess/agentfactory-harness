import type { CellBuffer } from '../renderer/cell-buffer.js'
import { Colors } from '../renderer/theme.js'
import type { Rect } from '../renderer/layout.js'

const VERSION = '0.1.0'

export function renderStatusBar(buf: CellBuffer, rect: Rect, mode = 'NORMAL'): void {
  const { row, col, width } = rect
  const bg = Colors.bgActive

  // Fill background
  buf.write(row, col, ' '.repeat(width), { bg })

  // Left: mode indicator
  const left = ` factory v${VERSION}  [${mode}] `
  buf.write(row, col, left, { fg: Colors.textBright, bg, bold: true })

  // Right: keybind hints
  const right = ' ^Q quit  Tab/F1-F3 focus '
  buf.write(row, col + width - right.length, right, { fg: Colors.textDim, bg })
}
