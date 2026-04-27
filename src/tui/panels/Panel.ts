import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { KeyEvent } from '../input/keyboard.js'
import type { MouseEvent } from '../input/mouse.js'
import type { Rect } from '../renderer/layout.js'

export abstract class Panel {
  rect: Rect
  focused = false

  constructor(rect: Rect) {
    this.rect = rect
  }

  /** Render this panel's content into the buffer. */
  abstract render(buf: CellBuffer): void

  /** Handle a keyboard event. Return true if consumed. */
  onKey(_event: KeyEvent): boolean { return false }

  /** Handle a mouse event. Return true if consumed. */
  onMouse(_event: MouseEvent): boolean { return false }

  /** Inner content area (inside border). */
  get inner(): Rect {
    return {
      row:    this.rect.row + 1,
      col:    this.rect.col + 1,
      height: this.rect.height - 2,
      width:  this.rect.width - 2,
    }
  }
}
