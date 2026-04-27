import type { CellBuffer } from '../renderer/cell-buffer.js'
import { Colors, DBox, Wire } from '../renderer/theme.js'

export interface Block {
  id: string
  row: number    // 0-based, relative to canvas inner area
  col: number
  height: number
  width: number
  title: string
  status: 'idle' | 'running' | 'done' | 'error'
  outputs: string[]
  inputs: string[]
}

export function renderBlock(
  buf: CellBuffer,
  block: Block,
  focused: boolean,
  baseRow: number,
  baseCol: number,
  faded = false
): void {
  const { row, col, height, width, title, status, outputs, inputs } = block
  const r = baseRow + row
  const c = baseCol + col

  const borderFg = faded
    ? Colors.textDim
    : focused
    ? Colors.borderActive
    : Colors.border

  const style = { fg: borderFg }

  // Double-line border corners + edges
  buf.write(r, c, DBox.tl, style)
  buf.write(r, c + width - 1, DBox.tr, style)
  buf.write(r + height - 1, c, DBox.bl, style)
  buf.write(r + height - 1, c + width - 1, DBox.br, style)

  const hLine = DBox.h.repeat(width - 2)
  buf.write(r, c + 1, hLine, style)
  buf.write(r + height - 1, c + 1, hLine, style)

  for (let i = 1; i < height - 1; i++) {
    buf.write(r + i, c, DBox.v, style)
    buf.write(r + i, c + width - 1, DBox.v, style)
    buf.fill(r + i, c + 1, 1, width - 2, ' ', { bg: Colors.bgPanel })
  }

  // Title on header row
  const badge = statusBadge(status)
  const label = ` ${badge} ${title} `.substring(0, width - 2)
  const titleFg = faded ? Colors.textDim : Colors.textBright
  buf.write(r, c + 1, label, { fg: titleFg, bold: !faded })

  // Output ports (right edge)
  for (let i = 0; i < outputs.length && i + 1 < height - 1; i++) {
    const portLabel = (outputs[i] ?? '').substring(0, width - 3)
    const portRow = r + 1 + i
    const portFg = faded ? Colors.textDim : Colors.info
    buf.write(portRow, c + 1, portLabel, { fg: portFg })
    buf.write(portRow, c + width - 1, Wire.portOut, { fg: portFg })
  }

  // Input ports (left edge)
  for (let i = 0; i < inputs.length && i + 1 < height - 1; i++) {
    const portLabel = (inputs[i] ?? '').substring(0, width - 3)
    const portRow = r + 1 + i
    const portFg = faded ? Colors.textDim : Colors.accent
    buf.write(portRow, c, Wire.portIn, { fg: portFg })
    buf.write(portRow, c + 1, portLabel, { fg: portFg })
  }
}

function statusBadge(status: Block['status']): string {
  switch (status) {
    case 'idle':    return '○'
    case 'running': return '●'
    case 'done':    return '✓'
    case 'error':   return '✗'
  }
}
