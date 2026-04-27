# Approved Plan: Wave 2 — ITUI Canvas
<!-- version: 1.0.0 -->
<!-- approved: 2026-04-27 -->

## Goal

Implement the interactive TUI canvas that is the defining visual feature of
agentfactory-harness: mouse-driven block dragging with snap-to-grid, L-shaped
wire routing between agent ports, and a right-click context menu.

---

## Key design decisions

### Mouse protocol

xterm SGR extension is required for columns > 223. Enable sequence:
`\033[?1000h\033[?1002h\033[?1006h` (button events + motion + SGR).

SGR event format on stdin (already enabled by App.setup()):
```
\033[<{flags};{col};{row}M   ← press
\033[<{flags};{col};{row}m   ← release
```
- `flags` bits 0–1: button (0=left, 1=middle, 2=right)
- `flags` bit 2: shift, bit 3: alt, bit 4: ctrl
- `flags` bit 5: motion (button held while moving)
- `flags` bit 6+: scroll wheel (buttons 64/65)
- coords are 1-based; convert to 0-based in `parseMouse`

Detection prefix: `str.startsWith('\x1b[<')` — already dropped by keyboard.ts.

### Hit testing

A click at canvas-relative `(r, c)` hits block B if:
```
B.row <= r < B.row + B.height  AND  B.col <= c < B.col + B.width
```
Header = `B.row`. Drag starts only when the header row is clicked.
Ports are the last character on each non-header row (output = right edge,
input = left edge).

### Grid snap

Blocks snap on mouseup to a 2-row × 4-col grid:
```typescript
{ row: Math.round(pos.row / 2) * 2, col: Math.round(pos.col / 4) * 4 }
```

### Wire routing (L-shape)

Two-segment L-path. Given output port `O` and input port `I`:
- If `O.col < I.col`: go right to midpoint col, then up/down to `I.row`, then right
- If `O.col >= I.col`: go down/up past both blocks, then route horizontally

Simple case used in Wave 2:
```
O ─────────┐
           │
           └────── I
```
`WirePath` = `Array<{ row: number; col: number; char: string }>` — each cell to paint.

### Ghost rendering

During drag, draw the dragged block at `(cursor.row - offset.row, cursor.col - offset.col)`
using `Colors.textDim` colors (faded), then draw the real block at original position
with a dashed border. On mouseup: move real block, clear ghost.

---

## Public types

```typescript
// mouse.ts
export interface MouseEvent {
  button: 'left' | 'middle' | 'right' | 'scroll_up' | 'scroll_down' | 'motion'
  action: 'press' | 'release' | 'move'
  row: number   // 0-based
  col: number   // 0-based
  shift: boolean; ctrl: boolean; alt: boolean
}
export function parseMouse(data: Buffer): MouseEvent | null

// router.ts
export class InputRouter {
  dispatch(event: KeyEvent | MouseEvent, panels: Panel[], focusedIdx: number): void
}

// Block widget
export interface Block {
  id: string; row: number; col: number; height: number; width: number
  title: string; status: 'idle' | 'running' | 'done' | 'error'
  outputs: string[]; inputs: string[]
}
export function renderBlock(buf: CellBuffer, block: Block, focused: boolean): void

// Wire widget
export interface WirePoint { row: number; col: number; char: string }
export function routeWire(
  from: { row: number; col: number },
  to:   { row: number; col: number }
): WirePoint[]

// OrchestrationCanvas
export interface CanvasState {
  blocks: Block[]; wires: CanvasWire[]
  drag: { kind: 'idle' } | { kind: 'dragging'; blockId: string; offsetRow: number; offsetCol: number }
}
export class OrchestrationCanvas extends Panel {
  loadState(state: CanvasState): void
  getState(): CanvasState
}
```

---

## Test targets

| File | Scenarios |
|------|-----------|
| `src/tui/input/mouse.test.ts` | left/right/middle press+release, motion, scroll, modifier bits, 1→0 coord conversion |
| `src/tui/widgets/wire.test.ts` | same row, same col, diagonal; path covers all needed cells |
| `src/tui/panels/orchestration-canvas.test.ts` | hit test, drag state machine (press→move→release), snap, wire add/remove |

---

## Release

- Branch: `feature/wave-2-canvas`
- PR title: `feat: Wave 2 — ITUI mouse canvas, block drag, wire routing`
- Tag: `v0.3.0`
