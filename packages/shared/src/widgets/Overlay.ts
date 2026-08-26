import type { CellBuffer } from '../renderer/cell-buffer.js'
import type { Rect } from '../renderer/layout.js'
import type { KeyEvent } from '../input/keyboard.js'
import type { MouseEvent } from '../input/mouse.js'
import { Colors } from '../renderer/theme.js'

/** Width caps per size tier (gap 8: replaces hard-coded 46/56/58/64). */
export type OverlayTier = 'sm' | 'md' | 'lg'

const TIER_WIDTH: Record<OverlayTier, number> = { sm: 46, md: 56, lg: 64 }

export interface OverlayOpts {
  title: string
  tier: OverlayTier
  /** Dim hint rendered on the bottom border (e.g. 'Enter save · Esc cancel'). */
  footerHint?: string
  /** Called on Esc or click-outside. */
  onDismiss: () => void
}

export interface OverlayFrame {
  row: number
  col: number
  width: number
  height: number
  /** Content area inside the border. */
  inner: Rect
}

/**
 * Shared modal frame: centered geometry, border, title, footer hint, and the
 * standard dismissal convention (Esc + click-outside). Hosts render their own
 * content into `frame.inner` — field editing, spinners and lists stay bespoke.
 */
export class Overlay {
  constructor(private readonly opts: OverlayOpts) {}

  /** Centered geometry inside `container` for `contentRows` rows of content. */
  layout(container: Rect, contentRows: number): OverlayFrame {
    const width = Math.min(container.width - 4, TIER_WIDTH[this.opts.tier])
    const height = Math.min(contentRows + 2, container.height - 4)
    const row = container.row + Math.max(0, Math.floor((container.height - height) / 2))
    const col = container.col + Math.floor((container.width - width) / 2)
    return {
      row, col, width, height,
      inner: { row: row + 1, col: col + 1, height: height - 2, width: width - 2 },
    }
  }

  /** Draw the frame (fill, border, title, footer hint) and return its geometry. */
  renderFrame(buf: CellBuffer, container: Rect, contentRows: number, titleOverride?: string): OverlayFrame {
    const f = this.layout(container, contentRows)
    const style = { fg: Colors.focus, bg: Colors.surfacePanel }
    const hLine = '─'.repeat(f.width - 2)

    buf.fill(f.row, f.col, f.height, f.width, ' ', { bg: Colors.surfacePanel })
    buf.write(f.row, f.col, '┌' + hLine + '┐', style)
    buf.write(f.row + f.height - 1, f.col, '└' + hLine + '┘', style)
    for (let i = 1; i < f.height - 1; i++) {
      buf.write(f.row + i, f.col, '│', style)
      buf.write(f.row + i, f.col + f.width - 1, '│', style)
    }

    const title = ` ${titleOverride ?? this.opts.title} `
    buf.write(f.row, f.col + 2, title.substring(0, f.width - 4), {
      fg: Colors.textBright, bg: Colors.surfacePanel, bold: true,
    })

    if (this.opts.footerHint) {
      const hint = ` ${this.opts.footerHint} `
      const col = f.col + Math.max(2, f.width - hint.length - 2)
      buf.write(f.row + f.height - 1, col, hint.substring(0, f.width - 4), {
        fg: Colors.textDim, bg: Colors.surfacePanel,
      })
    }
    return f
  }

  /** True if (row, col) lies inside the frame (border included). */
  contains(frame: OverlayFrame, row: number, col: number): boolean {
    return row >= frame.row && row < frame.row + frame.height &&
           col >= frame.col && col < frame.col + frame.width
  }

  /** Standard key dismissal: Esc → onDismiss. Returns true if handled. */
  handleKey(e: KeyEvent): boolean {
    if (e.key === 'escape') {
      this.opts.onDismiss()
      return true
    }
    return false
  }

  /**
   * Standard mouse dismissal: left-press outside the frame → onDismiss.
   * Returns true if the event was consumed (dismissed); false when the click
   * is inside the frame (host handles content clicks).
   */
  handleMouse(e: MouseEvent, frame: OverlayFrame): boolean {
    if (e.button === 'left' && e.action === 'press' && !this.contains(frame, e.row, e.col)) {
      this.opts.onDismiss()
      return true
    }
    return false
  }
}
