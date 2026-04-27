export interface WirePoint {
  row: number
  col: number
  char: string
}

/**
 * Route an L-shaped wire from output port `from` to input port `to`.
 * Returns an array of (row, col, char) cells to paint.
 *
 * Same-row: straight horizontal line including both endpoints.
 * Different rows: horizontal from `from` to midpoint, vertical to `to.row`,
 * then horizontal to `to`. Arrow head always placed at `to`.
 */
export function routeWire(
  from: { row: number; col: number },
  to:   { row: number; col: number }
): WirePoint[] {
  if (from.row === to.row && from.col === to.col) return []

  const hDir = to.col > from.col ? 1 : to.col < from.col ? -1 : 0
  const points: WirePoint[] = []

  // Same row — straight horizontal
  if (from.row === to.row) {
    for (let c = from.col; c !== to.col; c += hDir) {
      points.push({ row: from.row, col: c, char: '─' })
    }
    points.push({ row: to.row, col: to.col, char: hDir >= 0 ? '►' : '◄' })
    return points
  }

  const vDir = to.row > from.row ? 1 : -1
  const midCol = from.col + Math.floor((to.col - from.col) / 2)
  const effectiveHDir = hDir !== 0 ? hDir : 1

  // Horizontal: from → midpoint
  for (let c = from.col; c !== midCol; c += effectiveHDir) {
    points.push({ row: from.row, col: c, char: '─' })
  }

  // Corner at top of vertical
  points.push({ row: from.row, col: midCol, char: vDir > 0 ? '╮' : '╯' })

  // Vertical segment
  for (let r = from.row + vDir; r !== to.row; r += vDir) {
    points.push({ row: r, col: midCol, char: '│' })
  }

  // Corner at bottom of vertical
  points.push({ row: to.row, col: midCol, char: vDir > 0 ? '╰' : '╭' })

  // Horizontal: midpoint → to (including to.col as arrow)
  for (let c = midCol + effectiveHDir; c !== to.col; c += effectiveHDir) {
    points.push({ row: to.row, col: c, char: '─' })
  }
  points.push({ row: to.row, col: to.col, char: effectiveHDir >= 0 ? '►' : '◄' })

  return points
}
