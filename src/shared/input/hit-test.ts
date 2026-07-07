import type { Rect } from '../renderer/layout.js'

export function rectContains(r: Rect, row: number, col: number): boolean {
  return row >= r.row && row < r.row + r.height &&
         col >= r.col && col < r.col + r.width
}

/**
 * Named clickable zones, rebuilt each render by the host (gap 9: replaces the
 * ad-hoc statusBar*Col/Len fields). Later registrations win on overlap
 * (topmost chrome registers last).
 */
export class HitMap {
  private zones: Array<{ id: string; rect: Rect }> = []

  set(id: string, rect: Rect): void {
    this.zones.push({ id, rect })
  }

  clear(): void {
    this.zones = []
  }

  at(row: number, col: number): string | null {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]!
      if (rectContains(z.rect, row, col)) return z.id
    }
    return null
  }
}
