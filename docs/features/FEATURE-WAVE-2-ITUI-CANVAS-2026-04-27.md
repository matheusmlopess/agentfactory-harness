# Feature: Wave 2 — ITUI Mouse Canvas
<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-04-27 -->
<!-- last-updated: 2026-06-19 -->

## What it does

Adds the interactive TUI (ITUI) canvas that is the defining visual feature of
agentfactory-harness: mouse-driven agent block dragging with snap-to-grid, L-shaped
wire routing between output and input ports, and a right-click context menu. The SGR
mouse parser and `InputRouter` provide the input foundation for all future interactive
panels.

---

## Architecture

```
╔══════════════════════════════════════════════════════════════════════╗
║                     factory — Wave 2 layers                         ║
║                                                                      ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │  src/app.ts  — wires parseMouse + InputRouter              │    ║
║  └────────┬────────────────────────────────────────────────────┘    ║
║           │ stdin raw bytes                                          ║
║           ▼                                                          ║
║  ┌────────────────────┐   ┌──────────────────────────────────────┐  ║
║  │  Input Layer       │   │  Canvas Layer                        │  ║
║  │                    │   │                                      │  ║
║  │  mouse.ts          │──►│  OrchestrationCanvas.ts              │  ║
║  │  parseMouse()      │   │    ├── hitTestHeader()  (drag start) │  ║
║  │  keyboard.ts       │   │    ├── handleMouseMove() (ghost)     │  ║
║  │  parseKey()        │   │    ├── handleLeftRelease() (snap)    │  ║
║  │                    │   │    └── openContextMenu() (right-clk) │  ║
║  │  router.ts         │   │                                      │  ║
║  │  InputRouter       │   │  widgets/Block.ts  renderBlock()     │  ║
║  │  dispatch()        │   │  widgets/Wire.ts   routeWire()       │  ║
║  └────────────────────┘   │  widgets/ContextMenu.ts              │  ║
║                           └──────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════╝
```

| Symbol | Meaning |
|--------|---------|
| `╔═╗╚╝║` | Double-line box — top-level layer boundary |
| `┌─┐└┘│` | Single-line box — module |
| `──►` | Data flow direction |
| `├──` | Component within a module |

### Key files

| File | Role |
|------|------|
| `src/tui/input/mouse.ts` | `parseMouse(data)` — Buffer → `MouseEvent \| null` |
| `src/tui/input/router.ts` | `InputRouter.dispatch()` — routes key/mouse to panels |
| `src/tui/widgets/Block.ts` | `renderBlock()` — double-line box with ports and status badge |
| `src/tui/widgets/Wire.ts` | `routeWire(from, to)` — L-shaped path as `WirePoint[]` |
| `src/tui/widgets/ContextMenu.ts` | `ContextMenu` — popup menu with keyboard nav |
| `src/tui/panels/OrchestrationCanvas.ts` | Full drag-drop canvas — state machine + rendering |

---

## How it works

### Mouse input: SGR protocol parsing

```
┌──────────────────────────────────────────────────────────────────┐
│  stdin raw bytes arrive (same stream as keyboard)                │
│                                                                  │
│  str.startsWith('\x1b[<') ?                                      │
│           │                                                      │
│    No ────┤──► parseKey()    — keyboard event                    │
│           │                                                      │
│    Yes ───┤──► parseMouse()                                      │
│                │                                                 │
│                │  Parse: \033[< {flags} ; {col} ; {row} M/m     │
│                │                                                 │
│                │  flags bits:                                    │
│                │    0-1  → button (0=left 1=mid 2=right)        │
│                │    2    → shift                                 │
│                │    3    → alt                                   │
│                │    4    → ctrl                                  │
│                │    5    → motion (held+moved)                   │
│                │    6    → scroll wheel                          │
│                │                                                 │
│                │  M=press m=release                              │
│                │  coords: 1-based → 0-based (subtract 1)        │
│                │                                                 │
│                └──► MouseEvent { button, action, row, col, ... }│
└──────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `──►` | Code path taken |
| `M/m` | Terminal character suffix — M=press, m=release |
| `0-based` | Convert at parse boundary; all downstream code uses 0-based coords |

### Drag state machine

```
┌─────────────────────────────────────────────────────────────────────┐
│  OrchestrationCanvas drag state machine                             │
│                                                                     │
│         ╭────────────────────────────────────────────╮             │
│         │              IDLE                          │             │
│         ╰─────────────────────┬──────────────────────╯             │
│                               │                                     │
│                  left-press on block header                        │
│                  → record blockId + offset                         │
│                               │                                     │
│                               ▼                                     │
│         ╭────────────────────────────────────────────╮             │
│         │           DRAGGING                         │             │
│         │  blockId: string                           │             │
│         │  offsetRow: number   offsetCol: number     │             │
│         ╰───┬──────────────────┬──────────────────┬──╯             │
│             │                  │                  │                │
│        mousemove          escape/q          mouseup               │
│             │                  │                  │                │
│       render ghost        cancel drag       snap to grid          │
│       at cursor−offset    → IDLE            → IDLE                │
│                                              update block.row/col  │
└─────────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `╭─╮╰─╯` | State node |
| `▼` | Transition direction |
| `→ IDLE` | State returns to idle |

**Grid snap formula:**
```typescript
row: Math.max(0, Math.round(rawRow / 2) * 2)
col: Math.max(0, Math.round(rawCol / 4) * 4)
```

### Wire routing algorithm

```
┌───────────────────────────────────────────────────────────────────┐
│  routeWire(from, to) — L-shaped path                              │
│                                                                   │
│  same row? ──Yes──► horizontal straight line from→to             │
│       │                                                           │
│       No                                                          │
│       │                                                           │
│  midCol = from.col + floor((to.col - from.col) / 2)              │
│                                                                   │
│  ① horizontal: from.col ──── midCol     (row = from.row)         │
│  ② corner ╮ or ╯ at (from.row, midCol)                           │
│  ③ vertical: from.row → to.row          (col = midCol)            │
│  ④ corner ╰ or ╭ at (to.row, midCol)                             │
│  ⑤ horizontal: midCol ──── to.col ►     (row = to.row)           │
│                                         (last char = ► or ◄)    │
└───────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `──Yes──►` | Branch path |
| `①–⑤` | Ordered path segment |
| `► / ◄` | Arrow head at destination |
| `╮ ╯ ╰ ╭` | Corner characters chosen by direction |

### InputRouter: panel hit testing

```
┌──────────────────────────────────────────────────────────────────┐
│  InputRouter.dispatch(event, panels, focusedIdx)                 │
│                                                                  │
│  KeyEvent?  ──Yes──► panels[focusedIdx].onKey(event)            │
│      │                                                           │
│      No (MouseEvent)                                             │
│      │                                                           │
│  for each panel:                                                 │
│    panel.rect contains event.{row, col}?                         │
│        │                                                         │
│        Yes ──► panel.onMouse(event) → return true               │
│        │                                                         │
│        No  ──► next panel                                        │
│                                                                  │
│  No panel matched → return false                                │
└──────────────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `──Yes──►` | Branch — condition met |
| `──►` | Method call / data flow |

Mouse events are dispatched to whichever panel's rect contains the click —
regardless of which tab is focused. This means right-clicking on the canvas
while the session panel is focused still opens the canvas context menu.

---

## Usage

### Launch and interact with the canvas

```bash
$ factory
# Press 2 or Tab to Tab focus the Orchestration panel.
# Right-click → "Add agent block" to create a block at cursor position.
# Left-click on block header → drag block to new position.
# Release → block snaps to 2×4 grid.
# Right-click on block → "Open session" or "Delete block".
# Escape → close context menu.
```

### Inspect wire routing manually

```bash
$ node -e "
import { routeWire } from './dist/tui/widgets/Wire.js'
const pts = routeWire({ row: 1, col: 2 }, { row: 4, col: 12 })
console.log(pts.map(p => \`(\${p.row},\${p.col}) \${p.char}\`).join('\\n'))
"
```

### Run tests

```bash
$ npm test
# 46 tests across 8 files — all must pass
```

---

## Test coverage

| File | Tests | What is covered |
|------|-------|----------------|
| `src/tui/input/mouse.test.ts` | 11 | left/right/middle press+release, scroll, motion, modifier bits, 1→0 coord conversion |
| `src/tui/widgets/wire.test.ts` | 6 | same row, L-shape, right-to-left, arrow char, no duplicate cells |
| `src/tui/panels/orchestration-canvas.test.ts` | 6 | state load, drag start on header, no drag on body, snap-to-grid, context menu add block, out-of-bounds click |

**Not yet tested:**
- `renderBlock()` visual output (requires CellBuffer snapshot test)
- `ContextMenu.render()` (requires TTY harness)
- Wire rendering onto canvas (integration, deferred to Wave 2.1)
- Wiring two blocks by clicking ports (pointer-to-port detection, Wave 2.1)
- Scroll wheel panning of canvas viewport (Wave 2.1)

---

## Known limitations

- **No wire creation from UI.** `CanvasWire` entries can be loaded via `loadState()` and
  are rendered, but the user cannot yet draw wires interactively. Port-click detection
  and drag-to-wire is Wave 2.1.
- **No canvas scrolling.** The inner rect is the full viewport. Pan/zoom is Wave 2.1.
- **Context menu is dismissed on any press.** Clicking outside the menu before confirming
  an item closes it immediately — this is intentional for Wave 2 simplicity.
- **No block resize.** Block dimensions are fixed at creation (5 rows × 18 cols).
- **Ghost renders on top of real block.** During drag the ghost and the original occupy
  the same position until `mousemove` fires. This is a visual glitch that clears on the
  first move event.
