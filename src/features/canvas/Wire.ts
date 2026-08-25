export interface WirePoint {
  row: number
  col: number
  char: string
}

/** Corner glyph where the leading horizontal run turns into the vertical. */
function topCorner(hIn: number, vOut: number): string {
  if (hIn === 0) return '│' // pure vertical start — no turn
  if (hIn > 0) return vOut > 0 ? '╮' : '╯'
  return vOut > 0 ? '╭' : '╰'
}

/** Corner glyph where the vertical turns into the trailing horizontal run. */
function bottomCorner(vIn: number, hOut: number): string {
  if (vIn > 0) return hOut > 0 ? '╰' : '╯'
  return hOut > 0 ? '╭' : '╮'
}

/**
 * Route an L-shaped wire from output port `from` to input port `to`.
 * Returns an array of (row, col, char) cells to paint.
 *
 * Same-row: straight horizontal line including both endpoints.
 * Different rows: horizontal from `from` to midpoint, vertical to `to.row`,
 * then horizontal to `to`. Arrow head always placed at `to`.
 *
 * Termination invariant: every loop steps by `Math.sign(end − start)` of its
 * OWN segment, and a zero-length segment (sign 0) never enters its loop — so
 * no combination of endpoints can diverge. Vertical / near-vertical wires
 * (no trailing horizontal run) end in a ▼/▲ arrow instead of a corner.
 */
export function routeWire(
  from: { row: number; col: number },
  to:   { row: number; col: number }
): WirePoint[] {
  if (from.row === to.row && from.col === to.col) return []

  const points: WirePoint[] = []

  // Same row — straight horizontal
  if (from.row === to.row) {
    const hDir = Math.sign(to.col - from.col) // never 0 here
    for (let c = from.col; c !== to.col; c += hDir) {
      points.push({ row: from.row, col: c, char: '─' })
    }
    points.push({ row: to.row, col: to.col, char: hDir > 0 ? '►' : '◄' })
    return points
  }

  const vDir = to.row > from.row ? 1 : -1
  const midCol = from.col + Math.floor((to.col - from.col) / 2)
  const h1 = Math.sign(midCol - from.col) // 0 ⇒ no leading horizontal run
  const h2 = Math.sign(to.col - midCol)   // 0 ⇒ no trailing horizontal run

  // Horizontal: from → midpoint
  for (let c = from.col; c !== midCol; c += h1) {
    points.push({ row: from.row, col: c, char: '─' })
  }

  // Corner at top of vertical
  points.push({ row: from.row, col: midCol, char: topCorner(h1, vDir) })

  // Vertical segment
  for (let r = from.row + vDir; r !== to.row; r += vDir) {
    points.push({ row: r, col: midCol, char: '│' })
  }

  // Vertical / near-vertical wire: arrow lands vertically on `to`
  if (h2 === 0) {
    points.push({ row: to.row, col: to.col, char: vDir > 0 ? '▼' : '▲' })
    return points
  }

  // Corner at bottom of vertical
  points.push({ row: to.row, col: midCol, char: bottomCorner(vDir, h2) })

  // Horizontal: midpoint → to (including to.col as arrow)
  for (let c = midCol + h2; c !== to.col; c += h2) {
    points.push({ row: to.row, col: c, char: '─' })
  }
  points.push({ row: to.row, col: to.col, char: h2 > 0 ? '►' : '◄' })

  return points
}
