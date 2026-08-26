import type { CellBuffer } from '../renderer/cell-buffer.js'
import { Colors } from '../renderer/theme.js'
import type { Rect } from '../renderer/layout.js'
import { getVersion } from '@factory/core/version.js'

export interface StatusBarLayout {
  /** Column where the model tag starts (-1 if not shown). */
  modelTagCol: number
  /** Length of the model tag string. */
  modelTagLen: number
  /** Column where the tool toggle starts (-1 if not shown). */
  toolToggleCol: number
  /** Length of the tool toggle string. */
  toolToggleLen: number
}

export function renderStatusBar(
  buf:       CellBuffer,
  rect:      Rect,
  mode      = 'NORMAL',
  error?:    string,
  modelId?:  string,
  chatMode? : boolean,
): StatusBarLayout {
  const { row, col, width } = rect
  const bg = Colors.surfaceActive

  buf.write(row, col, ' '.repeat(width), { bg })

  if (error) {
    const msg = ` ⚠ ${error} `.substring(0, width)
    buf.write(row, col, msg, { fg: Colors.surface, bg: Colors.danger, bold: true })
    return { modelTagCol: -1, modelTagLen: 0, toolToggleCol: -1, toolToggleLen: 0 }
  }

  const left = ` factory v${getVersion()}  [${mode}] `
  buf.write(row, col, left, { fg: Colors.textBright, bg, bold: true })

  // Model tag + tool toggle — clickable indicators
  let modelTagCol = -1, modelTagLen = 0
  let toolToggleCol = -1, toolToggleLen = 0
  let nextCol = col + left.length

  if (modelId) {
    const tag = `[${modelId}]`
    modelTagLen = tag.length
    if (nextCol + modelTagLen < col + width - 36) {
      modelTagCol = nextCol
      buf.write(row, nextCol, tag, { fg: Colors.primary, bg, bold: false })
      nextCol += modelTagLen
    }
  }

  if (chatMode !== undefined) {
    const toggle = chatMode ? ' [chat] ' : ' [tools] '
    toolToggleLen = toggle.length
    if (nextCol + toolToggleLen < col + width - 36) {
      toolToggleCol = nextCol
      const toggleBg = chatMode ? Colors.success : Colors.primary
      buf.write(row, nextCol, toggle, { fg: Colors.surface, bg: toggleBg, bold: true })
      nextCol += toolToggleLen
    }
  }

  const right = ' ^Q quit  ^E select/copy  Tab focus  ^R run '
  buf.write(row, col + width - right.length, right, { fg: Colors.textDim, bg })

  return { modelTagCol, modelTagLen, toolToggleCol, toolToggleLen }
}
