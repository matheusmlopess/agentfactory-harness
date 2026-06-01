# Approved Plan: Canvas Interactive Wiring — click-to-connect handoff lines
<!-- version: 1.0.0 -->
<!-- approved: 2026-05-31 -->

## Goal

Allow users to visually connect agent blocks by clicking on an output port `○` of
one block, then clicking on an input port `●` of another, creating a handoff wire.
Wires can be deleted by right-clicking them. This makes the canvas fully interactive
without touching the keyboard or editing af-plan.json by hand.

---

## Scope

| File | Action |
|------|--------|
| `src/tui/panels/OrchestrationCanvas.ts` | **extend** — wiring interaction state, port hit-tests, wire preview, delete-wire context menu |
| `src/tui/panels/orchestration-canvas.test.ts` | **extend** — new tests: port hit-test, wire creation, duplicate prevention, cancel |

No new files needed — the `CanvasWire`, `routeWire`, and `Block` types are already in place.

---

## Reference material

| Decision | Reference |
|----------|-----------|
| `dependsOn` DAG model — wire = directed dependency edge | `open-multi-agent/src/task/task.ts:29–53` |
| Existing output `○` / input `●` port positions | `src/tui/widgets/Block.ts:58–74` (existing project) |
| Wire routing (L-shape, corners, arrow) | `src/tui/widgets/Wire.ts` (existing project) |
| Interaction state union pattern | `OrchestrationCanvas.ts:21–28` (existing project) |

---

## Architecture

### New interaction state

```ts
type DragState =
  | { kind: 'idle' }
  | { kind: 'dragging'; blockId: string; offsetRow: number; offsetCol: number }
  | { kind: 'wiring';   fromBlockId: string; fromPort: string;
                        cursorRow: number; cursorCol: number }
```

### Wire creation flow

```
User left-clicks ○ output port
  → DragState becomes { kind: 'wiring', fromBlockId, fromPort, cursorRow, cursorCol }
  → Canvas highlights source block border in Colors.warning (orange)
  → All valid target ● input ports glow Colors.success (green)
  → A live preview wire (Colors.warning) routes from source port to cursor

User moves mouse (action='move')
  → cursorRow / cursorCol updated → preview redraws each frame

User left-clicks ● input port of a DIFFERENT block
  → Wire created: { id, fromBlockId, fromPort, toBlockId, toPort }
  → Guards: no self-loop, no duplicate (same from+to already exists)
  → DragState → idle

User left-clicks anywhere else (not a valid input port)
  → DragState → idle (cancel, no wire created)

User presses Esc while wiring
  → DragState → idle
```

### Wire deletion flow

```
User right-clicks on a wire cell
  → Hit-test: iterate all wires, compute routeWire paths, check if click is on any cell
  → Context menu: [Delete wire]
  → Delete removes the matching CanvasWire from state.wires
```

### Port hit-test helpers

```ts
private hitTestOutputPort(row, col): { block: Block; portName: string } | undefined
private hitTestInputPort(row, col):  { block: Block; portName: string } | undefined
private hitTestWire(row, col): CanvasWire | undefined
```

`hitTestOutputPort`: matches `row === block.row + 1 + portIdx && col === block.col + block.width - 1`
`hitTestInputPort`:  matches `row === block.row + 1 + portIdx && col === block.col`
`hitTestWire`: iterates all wires via `routeWire(from, to)`, returns first wire whose path includes `(row, col)`

### Visual feedback during wiring

During `kind === 'wiring'` render pass (after blocks, before context menu):

1. Source block border drawn in `Colors.warning` (overrides normal focus colour)
2. All blocks with input ports: input port `●` drawn in `Colors.success`
3. Preview wire from `portPosition(fromBlockId, fromPort, 'output')` → `(cursorRow, cursorCol)`, colour `Colors.warning`, char `·` for all non-corner points (dashed look)
4. Cursor crosshair: `◎` at `(cursorRow, cursorCol)` in `Colors.warning`

### Changes to `handleLeftPress`

```ts
private handleLeftPress(row, col): boolean {
  // 1. If currently wiring → try to complete wire on input port click
  if (this.state.drag.kind === 'wiring') {
    const target = this.hitTestInputPort(row, col)
    const drag = this.state.drag
    if (target && target.block.id !== drag.fromBlockId) {
      const wireId = `${drag.fromBlockId}:${drag.fromPort}→${target.block.id}:${target.portName}`
      const duplicate = this.state.wires.some(w =>
        w.fromBlockId === drag.fromBlockId && w.fromPort === drag.fromPort &&
        w.toBlockId === target.block.id && w.toPort === target.portName
      )
      if (!duplicate) {
        this.state = {
          ...this.state,
          wires: [...this.state.wires, {
            id: wireId,
            fromBlockId: drag.fromBlockId,
            fromPort: drag.fromPort,
            toBlockId: target.block.id,
            toPort: target.portName,
          }],
          drag: { kind: 'idle' },
        }
      } else {
        this.state = { ...this.state, drag: { kind: 'idle' } }
      }
    } else {
      this.state = { ...this.state, drag: { kind: 'idle' } }
    }
    this.onUpdate(); return true
  }

  // 2. Check output port click → enter wiring mode
  const outPort = this.hitTestOutputPort(row, col)
  if (outPort) {
    this.state = { ...this.state, drag: {
      kind: 'wiring',
      fromBlockId: outPort.block.id,
      fromPort: outPort.portName,
      cursorRow: row,
      cursorCol: col,
    }}
    this.onUpdate(); return true
  }

  // 3. Existing header-drag logic
  return this.startDrag(row, col)
}
```

### Changes to `handleMouseMove`

```ts
if (drag.kind === 'wiring') {
  this.state = { ...this.state, drag: { ...drag, cursorRow: row, cursorCol: col } }
  this.onUpdate(); return true
}
```

### Changes to `onKey`

```ts
if (e.key === 'escape') {
  if (drag.kind === 'wiring') {
    this.state = { ...this.state, drag: { kind: 'idle' } }
    this.onUpdate(); return true
  }
  // existing menu escape
}
```

### Right-click: wire detection

In `openContextMenu`, before the block hit-test, check `hitTestWire`:

```ts
const wire = this.hitTestWire(row, col)
if (wire) {
  items = [{ label: 'Delete wire', danger: true, action: () => {
    this.state = { ...this.state, wires: this.state.wires.filter(w => w.id !== wire.id) }
    this.menu = null; this.onUpdate()
  }}]
}
```

---

## Test plan (`orchestration-canvas.test.ts` additions)

- `hitTestOutputPort` returns correct block + port for click on `○` position
- `hitTestInputPort` returns correct block + port for click on `●` position
- `hitTestWire` returns the wire when clicking a known wire cell
- Left-click on output port enters `wiring` drag state
- Mouse move while wiring updates `cursorRow`/`cursorCol`
- Left-click on valid input port creates wire, resets drag to idle
- Self-loop (same block) is rejected
- Duplicate wire is rejected
- Click on non-port while wiring cancels (drag → idle, no wire added)
- Esc key while wiring cancels
- Right-click on wire cell opens delete-wire context menu
- Delete wire removes it from state.wires

---

## Out of scope

- Named ports / multiple ports per block (existing single `out`/`in` is sufficient)
- Wire labels / annotations
- Cycle detection (DAG validation at executor level, not canvas)
- Undo/redo
