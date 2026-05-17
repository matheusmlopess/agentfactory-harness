import type { CellBuffer } from '../renderer/cell-buffer.js'
import { Colors } from '../renderer/theme.js'
import type { Rect } from '../renderer/layout.js'

const VERSION = '0.3.0'

export function renderStatusBar(buf: CellBuffer, rect: Rect, mode = 'NORMAL'): void {
  const { row, col, width } = rect
  const bg = Colors.bgActive

  buf.write(row, col, ' '.repeat(width), { bg })

  const left = ` factory v${VERSION}  [${mode}] `
  buf.write(row, col, left, { fg: Colors.textBright, bg, bold: true })

  const right = ' ^Q quit  Tab/F1-F3 focus  ^R run plan '
  buf.write(row, col + width - right.length, right, { fg: Colors.textDim, bg })
}
