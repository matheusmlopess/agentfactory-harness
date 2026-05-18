# Approved Plan: Wave 4 — TerminalPanel / PTY Embed
<!-- version: 1.0.0 -->
<!-- approved: 2026-05-18 -->

## Goal

Embed a real interactive shell inside the TUI by wrapping `node-pty` (already in
`package.json`) in a new `TerminalPanel`. A `VTScreen` class parses the PTY's ANSI
output stream into the existing `CellBuffer` abstraction so the raw ANSI renderer
can display it without any framework change. Input is forwarded as raw bytes when
the Terminal tab is focused, keeping the shell fully interactive.

---

## Scope

| File | Action | Wave |
|------|--------|------|
| `src/tui/input/vt.ts` | **new** — `VTScreen`: streaming ANSI parser + virtual screen | 4 |
| `src/tui/panels/TerminalPanel.ts` | **new** — `TerminalPanel extends Panel`; node-pty lifecycle | 4 |
| `src/tui/renderer/layout.ts` | **extend** — add `terminal: Rect` to `PanelLayout`; update `computeLayout` | 4 |
| `src/app.ts` | **extend** — 4th tab `Terminal`, F4 key, raw PTY input bypass, resize/destroy wiring | 4 |
| `.ai/project-index.yml` | **update** — add `vt.ts` + `TerminalPanel.ts` entries; bump `meta.wave` to 4 | 4 |

Test files:

| File | Action |
|------|--------|
| `src/tui/input/vt.test.ts` | VTScreen unit tests: text, cursor moves, SGR, erase |
| `src/tui/panels/TerminalPanel.test.ts` | TerminalPanel lifecycle with mocked IPty |

---

## Reference material

Informed by the following files inside `.refs/openclaude/`. All paths are repo-relative.

| Decision | Reference |
|----------|-----------|
| ANSI streaming token taxonomy (CSI / OSC / ESC / SS3) | `src/ink/termio/parser.ts:1–50` |
| Cursor operations (CUP / CUU / CUD / CUF / CUB / CHA / VPA) | `src/ink/termio/parser.ts:90–130` |
| Erase ops (ED display-to-end/to-start/all, EL line regions) | `src/ink/termio/parser.ts:130–155` |
| `TextStyle` shape — fg/bg/bold/dim/underline/reverse | `src/ink/termio/types.ts` |
| SGR color/attribute applicator | `src/ink/termio/sgr.ts` |
| PTY process lifecycle (spawn, result, cleanup, stall) | `src/tasks/LocalShellTask/LocalShellTask.tsx:70–90` |

---

## Architecture

### Layout change

`PanelLayout` gains a `terminal: Rect` that spans the full right column — the same
region that `canvas` + `agents` share — and is rendered in place of those two panels
when the Terminal tab (index 3) is active.

```
┌─────────────────────────────────────┐
│  Tab: Session | Orchestration | Agents | Terminal  │  ← row 0
├──────────────────┬──────────────────┤
│                  │                  │
│  SessionPanel    │  CanvasPanel     │  ← shown when tab 0, 1, 2
│  (40 %)          │  + AgentsPanel   │
│                  │                  │
│                  ├──────────────────┤
│                  │  AgentsPanel     │
├──────────────────┴──────────────────┤
│  SessionPanel    │  TerminalPanel   │  ← shown when tab 3
│  (40 %)          │  (60 %)          │
│                  │  (full right col)│
├─────────────────────────────────────┤
│  StatusBar                          │  ← last row
└─────────────────────────────────────┘
```

`computeLayout` sets `terminal = { row:1, col:sessionWidth, height:mainHeight, width:rightWidth }`.
App.render() conditionally renders canvas/agents OR terminal based on `activeTab`.

### VTScreen (`src/tui/input/vt.ts`)

A self-contained virtual terminal screen that consumes raw PTY bytes and maintains
a grid of styled cells plus a cursor. Public API:

```ts
export interface VTCell { char: string; style: VTStyle }
export interface VTStyle { fg: number | undefined; bg: number | undefined; bold: boolean; dim: boolean; underline: boolean; reverse: boolean }

export class VTScreen {
  constructor(rows: number, cols: number)
  feed(data: string): void           // consume PTY output chunk
  resize(rows: number, cols: number): void
  render(buf: CellBuffer, innerRect: Rect): void  // blast to CellBuffer
  get cursorRow(): number
  get cursorCol(): number
}
```

**Parsing strategy** (informed by `openclaude/src/ink/termio/parser.ts`):

Parse bytes as a state machine: `normal` → accumulate printable text; `escape` →
read ESC; `csi` → read CSI params until final byte (`@`…`~`); `osc` → read until
BEL/ST. On each complete sequence dispatch the action:

- **Text**: write chars at cursor, advance cursor, wrap at col boundary
- **CSI m (SGR)**: update current style
- **CSI H/f (CUP)**: set cursor row/col (1-based → 0-based)
- **CSI A/B/C/D (CUU/CUD/CUF/CUB)**: relative cursor move
- **CSI G (CHA)**: set cursor column
- **CSI J (ED)**: erase display (to-end / to-start / all)
- **CSI K (EL)**: erase line region
- **CR (`\r`)**: cursor column → 0
- **LF (`\n`)**: cursor row++; scroll grid if at bottom
- **BS (`\x08`)**: cursor column--

Ignore all other sequences (they don't affect cell content in most shells).

`render()` iterates the internal grid and calls `buf.write(innerRect.row + r, innerRect.col + c, cell.char, mappedStyle)` for each cell, mapping `VTStyle.fg/bg` from 256-colour palette values to the buf's style format.

### TerminalPanel (`src/tui/panels/TerminalPanel.ts`)

```ts
export class TerminalPanel extends Panel {
  private pty: IPty
  private screen: VTScreen

  constructor(rect: Rect, scheduleRender: () => void)
  render(buf: CellBuffer): void
  onKey(e: KeyEvent): boolean     // not used — input bypassed in app.ts
  write(data: Buffer): void       // raw bytes → pty.write()
  resize(rows: number, cols: number): void
  destroy(): void
}
```

PTY is spawned in the constructor:

```ts
this.pty = pty.spawn(
  process.env['SHELL'] ?? 'bash',
  [],
  { cols: inner.width, rows: inner.height, name: 'xterm-256color', cwd: process.cwd() },
)
this.pty.onData(chunk => { this.screen.feed(chunk); scheduleRender() })
this.pty.onExit(() => scheduleRender())
```

`inner` is `rect` shrunk by 1 on each side (the border). `resize()` calls
`this.pty.resize(cols, rows)` then `this.screen.resize(rows, cols)`.

### Input bypass in App (`src/app.ts`)

When `activeTab === 3` (Terminal focused), the `data` listener bypasses `parseKey()`
entirely and routes raw bytes directly:

```ts
// F1–F4 and Ctrl+Q checked as raw byte patterns first
if (data[0] === 0x11) { this.stop(); return }            // Ctrl+Q
if (data.equals(Buffer.from('\x1bOP'))) { this.activeTab=0; this.render(); return } // F1
if (data.equals(Buffer.from('\x1bOQ'))) { this.activeTab=1; this.render(); return } // F2
if (data.equals(Buffer.from('\x1bOR'))) { this.activeTab=2; this.render(); return } // F3
if (data.equals(Buffer.from('\x1bOS'))) { /* already on terminal */ return }        // F4
if (data[0] === 0x09) { /* Tab in terminal = literal tab, forward to pty */ }
// Everything else → forward raw bytes
this.terminalPanel.write(data)
return
```

`Tab` key (0x09) is forwarded to the PTY when terminal is focused (shells use Tab
for completion), so tab-switching only works via F1–F4 when the Terminal tab is active.

### Resize wiring

In the `process.stdout.on('resize', ...)` handler, after recomputing layout, call:
`this.terminalPanel.resize(layout.terminal.height - 2, layout.terminal.width - 2)`.

### Lifecycle

`App.stop()` calls `this.terminalPanel.destroy()` before writing cleanup sequences.

---

## Test plan

### `vt.test.ts` (VTScreen)
- Write text, advance cursor
- LF at bottom scrolls grid
- CR returns cursor to col 0
- CUP positions cursor (1-based → 0-based)
- SGR bold/dim/underline/reverse toggles
- SGR 38;5;N sets fg; 48;5;N sets bg; 39/49 reset
- ED 0 erases to end; ED 2 erases all
- EL 0 erases to line end
- `resize()` expands grid (new cells are blank)

### `TerminalPanel.test.ts`
- Constructor spawns PTY with correct initial cols/rows
- PTY data chunk feeds VTScreen and schedules render
- `resize()` calls pty.resize and screen.resize
- `destroy()` kills PTY process

---

## Key bindings (after Wave 4)

| Key | Action |
|-----|--------|
| F1 | Switch to Session tab |
| F2 | Switch to Orchestration tab |
| F3 | Switch to Agents tab |
| F4 | Switch to Terminal tab |
| Tab | Cycle tabs (unchanged — Tab in terminal forwarded as literal) |
| Ctrl+Q | Quit (always, even in terminal) |

---

## Out of scope (Wave 4)

- Scrollback buffer / scroll wheel
- Mouse forwarding to PTY
- Copy/paste (clipboard integration)
- Multiple PTY sessions / splits
- CommandPalette (tracked separately, Wave 1 leftover)
