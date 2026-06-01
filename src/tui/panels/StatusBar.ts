import type { CellBuffer } from '../renderer/cell-buffer.js'
import { Colors } from '../renderer/theme.js'
import type { Rect } from '../renderer/layout.js'

const VERSION = '0.4.0'

export interface StatusBarLayout {
  /** Column where the model tag starts (-1 if not shown). */
  modelTagCol: number
  /** Length of the model tag string. */
  modelTagLen: number
}

export function renderStatusBar(
  buf:      CellBuffer,
  rect:     Rect,
  mode     = 'NORMAL',
  error?:   string,
  modelId?: string,
): StatusBarLayout {
  const { row, col, width } = rect
  const bg = Colors.bgActive

  buf.write(row, col, ' '.repeat(width), { bg })

  if (error) {
    const msg = ` ⚠ ${error} `.substring(0, width)
    buf.write(row, col, msg, { fg: Colors.bg, bg: 196, bold: true })
    return { modelTagCol: -1, modelTagLen: 0 }
  }

  const left = ` factory v${VERSION}  [${mode}] `
  buf.write(row, col, left, { fg: Colors.textBright, bg, bold: true })

  // Model tag — clickable indicator next to [NORMAL]
  let modelTagCol = -1
  let modelTagLen = 0
  if (modelId) {
    const tag = `[${modelId}]`
    modelTagCol = col + left.length
    modelTagLen = tag.length
    if (modelTagCol + modelTagLen < col + width - 36) {
      buf.write(row, modelTagCol, tag, { fg: Colors.accent, bg, bold: false })
    }
  }

  const right = ' ^Q quit  ^E select/copy  Tab focus  ^R run '
  buf.write(row, col + width - right.length, right, { fg: Colors.textDim, bg })

  return { modelTagCol, modelTagLen }
}
