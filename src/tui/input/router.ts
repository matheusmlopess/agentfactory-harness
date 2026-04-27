import type { Panel } from '../panels/Panel.js'
import type { KeyEvent } from './keyboard.js'
import type { MouseEvent } from './mouse.js'

export class InputRouter {
  dispatch(
    event: KeyEvent | MouseEvent,
    panels: Panel[],
    focusedIdx: number
  ): boolean {
    const focused = panels[focusedIdx]
    if (!focused) return false

    if ('key' in event) {
      return focused.onKey(event)
    }

    // For mouse events, find the panel whose rect contains the click
    for (const panel of panels) {
      const r = panel.rect
      if (
        event.row >= r.row &&
        event.row < r.row + r.height &&
        event.col >= r.col &&
        event.col < r.col + r.width
      ) {
        return panel.onMouse(event)
      }
    }
    return false
  }
}
