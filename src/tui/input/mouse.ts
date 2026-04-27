export interface MouseEvent {
  button: 'left' | 'middle' | 'right' | 'scroll_up' | 'scroll_down' | 'motion'
  action: 'press' | 'release' | 'move'
  row: number    // 0-based
  col: number    // 0-based
  shift: boolean
  ctrl: boolean
  alt: boolean
}

const SGR_PREFIX = '\x1b[<'

/**
 * Parse an xterm SGR mouse event from a raw stdin buffer.
 * Returns null for non-mouse input (let keyboard.ts handle it).
 */
export function parseMouse(data: Buffer): MouseEvent | null {
  const str = data.toString('utf8')
  if (!str.startsWith(SGR_PREFIX)) return null

  // Format: ESC [ < flags ; col ; row M/m
  const inner = str.slice(SGR_PREFIX.length)
  const action: 'press' | 'release' = inner.endsWith('M') ? 'press' : 'release'
  const body = inner.slice(0, -1)
  const parts = body.split(';')
  if (parts.length !== 3) return null

  const flags = parseInt(parts[0] ?? '0', 10)
  const col   = parseInt(parts[1] ?? '1', 10) - 1  // 1-based → 0-based
  const row   = parseInt(parts[2] ?? '1', 10) - 1

  if (isNaN(flags) || isNaN(col) || isNaN(row)) return null

  const rawButton = flags & 0b11
  const isMotion  = (flags & 0b100000) !== 0
  const isScroll  = (flags & 0b1000000) !== 0

  let button: MouseEvent['button']
  if (isScroll) {
    button = rawButton === 0 ? 'scroll_up' : 'scroll_down'
  } else if (isMotion && action === 'press') {
    button = 'motion'
  } else {
    button = rawButton === 0 ? 'left' : rawButton === 1 ? 'middle' : 'right'
  }

  return {
    button,
    action: isMotion ? 'move' : action,
    row,
    col,
    shift: (flags & 0b100) !== 0,
    alt:   (flags & 0b1000) !== 0,
    ctrl:  (flags & 0b10000) !== 0,
  }
}
