import type { CellBuffer } from './cell-buffer.js'
import { Colors } from './theme.js'
import type { ConfigStore } from '../../core/config/store.js'

/**
 * Settings-based minimum terminal sizes (gaps 20–22). The user picks a
 * profile (Config → Interface, or the palette); below its minimum the app
 * renders a guard screen instead of a broken layout.
 */
export interface SizeProfile {
  id: 'compact' | 'standard' | 'wide'
  label: string
  minCols: number
  minRows: number
}

export const SIZE_PROFILES: readonly SizeProfile[] = [
  { id: 'compact',  label: 'Compact (80×24)',   minCols: 80,  minRows: 24 },
  { id: 'standard', label: 'Standard (110×30)', minCols: 110, minRows: 30 },
  { id: 'wide',     label: 'Wide (140×40)',     minCols: 140, minRows: 40 },
]

export function activeProfile(store: ConfigStore): SizeProfile {
  const id = store.getSetting('sizeProfile')
  return SIZE_PROFILES.find(p => p.id === id) ?? SIZE_PROFILES[0]!
}

export interface SizeCheck {
  ok: boolean
  deficitCols: number
  deficitRows: number
}

export function sizeCheck(rows: number, cols: number, p: SizeProfile): SizeCheck {
  return {
    ok: rows >= p.minRows && cols >= p.minCols,
    deficitCols: Math.max(0, p.minCols - cols),
    deficitRows: Math.max(0, p.minRows - rows),
  }
}

/** Centered "terminal too small" guard. Input still works behind it. */
export function renderTooSmall(buf: CellBuffer, rows: number, cols: number, p: SizeProfile): void {
  buf.fill(0, 0, rows, cols, ' ', { bg: Colors.surface })
  const lines = [
    '⚠ Terminal too small',
    `current ${cols}×${rows} · minimum ${p.minCols}×${p.minRows} (${p.id})`,
    'Resize the terminal to continue',
    'Ctrl+Q quit · Ctrl+P palette (switch size profile)',
  ]
  const startRow = Math.max(0, Math.floor((rows - lines.length * 2) / 2))
  lines.forEach((line, i) => {
    const col = Math.max(0, Math.floor((cols - line.length) / 2))
    buf.write(startRow + i * 2, col, line.substring(0, cols), {
      fg: i === 0 ? Colors.warning : Colors.text,
      bg: Colors.surface,
      bold: i === 0,
    })
  })
}
