# Feature: Wave 0 — Scaffold
<!-- version: 1.0.0 -->

## What it does

Establishes the complete foundational skeleton for `factory` — the agentfactory-harness CLI.
Wave 0 produces a runnable full-screen TUI with a static layout, a health-check command
(`factory doctor`), and all rendering primitives needed by later waves (cell-buffer,
ANSI sequences, layout engine, keyboard input, theming).

---

## Architecture

```
╔══════════════════════════════════════════════════════════════════════╗
║                        factory  (dist/index.js)                      ║
║                                                                      ║
║   ┌─────────────────────────────────────────────────────────────┐   ║
║   │  src/index.ts   — arg routing                               │   ║
║   │    subcommand? ──► commander (src/cli.ts)                   │   ║
║   │    no args?    ──► App.start()  (src/app.ts)                │   ║
║   └──────────────────────────┬──────────────────────────────────┘   ║
║                               │                                      ║
║          ┌────────────────────┼───────────────────────┐             ║
║          ▼                    ▼                        ▼             ║
║   ┌─────────────┐   ┌──────────────────┐   ┌────────────────────┐  ║
║   │  TUI Layer  │   │  Harness Layer   │   │   CLI Layer        │  ║
║   │             │   │                  │   │                    │  ║
║   │ renderer/   │   │ harness/doctor   │   │ cli.ts             │  ║
║   │  ansi.ts    │   │  runDoctor()     │   │  factory doctor    │  ║
║   │  theme.ts   │   │  printDoctor()   │   │  factory --version │  ║
║   │  cell-buf.  │   └──────────────────┘   └────────────────────┘  ║
║   │  layout.ts  │                                                    ║
║   │             │                                                    ║
║   │ input/      │                                                    ║
║   │  keyboard.ts│                                                    ║
║   │             │                                                    ║
║   │ panels/     │                                                    ║
║   │  Panel.ts   │                                                    ║
║   │  StatusBar  │                                                    ║
║   └─────────────┘                                                    ║
╚══════════════════════════════════════════════════════════════════════╝
```

| Symbol | Meaning |
|--------|---------|
| `╔═╗╚╝║` | Double-line box — top-level binary / layer boundary |
| `┌─┐└┘│` | Single-line box — module or class |
| `──►` | Control or data flow direction |
| `▼` | Downward data flow |

### Key files

| File | Role |
|------|------|
| `src/index.ts` | Entry point — arg routing |
| `src/cli.ts` | Commander subcommands (`doctor`, `--version`) |
| `src/app.ts` | `App` class — render loop, input loop, terminal lifecycle |
| `src/tui/renderer/ansi.ts` | Raw ANSI sequence builders |
| `src/tui/renderer/cell-buffer.ts` | `CellBuffer` — `Cell[][]`, `write`, `diff`, `flush`, `clone` |
| `src/tui/renderer/layout.ts` | `computeLayout()`, `drawBorder()`, `Rect` type |
| `src/tui/renderer/theme.ts` | Color palette, box-drawing char sets |
| `src/tui/input/keyboard.ts` | Raw stdin → `KeyEvent` |
| `src/tui/panels/Panel.ts` | Abstract panel base class |
| `src/tui/panels/StatusBar.ts` | `renderStatusBar()` — bottom status line |
| `src/harness/doctor.ts` | `runDoctor()`, `printDoctorReport()` |

---

## How it works

### Rendering pipeline

Every screen update passes through three stages:

```
┌──────────────────┐     write()     ┌──────────────────┐
│   App.render()   │ ──────────────► │  CellBuffer      │
│  (current frame) │                 │  (next frame)    │
└──────────────────┘                 └────────┬─────────┘
                                              │ diff(prev)
                                              ▼
                                    ┌──────────────────┐
                                    │  ANSI string     │  only changed cells
                                    └────────┬─────────┘
                                              │ process.stdout.write()
                                              ▼
                                    ┌──────────────────┐
                                    │  Terminal screen │
                                    └──────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `──►` | Method call or data flow |
| `▼` | Downward continuation |
| `diff(prev)` | Compares current `Cell[][]` against previous frame; emits ANSI only for changed cells |

`CellBuffer.diff(prev)` iterates every `[row][col]`, compares `char + fg + bg + bold`, and emits `\033[row;colH` + SGR codes only for dirty cells. This minimises stdout writes and eliminates flicker without double-buffering at the OS level.

### Layout computation

```
┌─────────────────────────────────────────────────────────┐
│  Terminal  cols × rows  (updated on SIGWINCH)           │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Tab bar  (row 0, full width)                     │  │
│  ├────────────────────────┬─────────────────────────┤  │
│  │  Session Panel         │  Canvas Panel           │  │
│  │  (40% width)           │  (60% width, top 70%)   │  │
│  │                        ├─────────────────────────┤  │
│  │                        │  Agents Panel           │  │
│  │                        │  (60% width, bot 30%)   │  │
│  ├────────────────────────┴─────────────────────────┤  │
│  │  Status Bar  (last row, full width)               │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `┌─┐└┘│├┤` | Panel boundary |
| `40% / 60%` | Width split from `computeLayout(rows, cols)` |
| `top 70% / bot 30%` | Canvas/Agents height split within right column |

`computeLayout` returns a `PanelLayout` record of `Rect` values (`{ row, col, height, width }`). Every caller receives `Rect` directly — no global state.

### Terminal lifecycle

`App.start()` owns the full terminal state lifecycle:

```
start()
  │
  ├── write( enterAltScreen )       \033[?1049h   — switch to alt screen buffer
  ├── write( enableMouse )          \033[?1000h\033[?1002h\033[?1006h
  ├── stdin.setRawMode(true)        — capture every keypress uncooked
  ├── process.on('SIGWINCH', ...)   — resize handler
  ├── process.on('SIGINT',  ...)    — Ctrl+C → stop()
  │
  ├── render()                      — first paint
  │
  └── listenInput()
        │
        ├── Tab          → cycle focused panel (0–3)
        ├── 1/2/3/4      → jump to panel index
        ├── q / Ctrl+Q   → stop()
        └── (other)      → dispatch to focused panel (Wave 1+)

stop()
  ├── write( disableMouse )         \033[?1000l
  ├── write( exitAltScreen )        \033[?1049l   — restore original screen
  └── process.exit(0)
```

| Symbol | Meaning |
|--------|---------|
| `├──` | Sequential step |
| `└──` | Final step / branch |
| `\033[...]` | ANSI escape sequence |

### Doctor check

`runDoctor(cwd)` runs five checks synchronously and returns `CheckResult[]`:

```
┌───────────────────────────────────────────────────────┐
│  runDoctor(cwd)                                       │
│                                                       │
│  ① Node.js ≥ 20 ?    process.version semver check    │
│  ② API key set?      ANTHROPIC_API_KEY env var        │
│  ③ Token file?       ~/.agentfactory/token existsSync │
│  ④ .ai/ harness?     existsSync(cwd + '/.ai')        │
│  ⑤ CLAUDE.md?        existsSync(cwd + '/CLAUDE.md')  │
│                                                       │
│  → CheckResult[]  { label, ok, detail }               │
└───────────────────────────────────────────────────────┘
         │
         ▼
  printDoctorReport()
    ✓ / ✗  colored table   →  stdout
    "N/M checks passed"    →  stdout
```

| Symbol | Meaning |
|--------|---------|
| `①–⑤` | Sequential check index |
| `→` | Return value or output |
| `✓ / ✗` | Pass / fail indicator in terminal output |

---

## Usage

### Launch the full-screen TUI

```bash
$ factory
```

Expected result: terminal switches to alt-screen, renders four panels with borders and
placeholder text, status bar at bottom. `Tab` cycles focus, `1`–`4` jump to a panel,
`q` or `Ctrl+Q` exits and restores the original terminal.

### Run health check

```bash
$ factory doctor
```

Expected output (all passing):

```
  ✓  Node.js ≥ 20       v22.1.0
  ✓  ANTHROPIC_API_KEY  set
  ✗  Token file         ~/.agentfactory/token not found
  ○  .ai/ harness       not present (optional for Wave 0)
  ✓  CLAUDE.md          present

  4/5 checks passed
```

### Print version

```bash
$ factory --version
# or
$ factory -v
# Output: 0.1.0
```

### Build

```bash
$ npm run build
# tsup compiles src/index.ts → dist/index.js (ESM, with .d.ts)

$ node dist/index.js --version
# 0.1.0
```

### Run tests

```bash
$ npm test
# vitest runs src/tui/renderer/cell-buffer.test.ts
# Expected: 4 tests pass
```

---

## Test coverage

**Test file:** `src/tui/renderer/cell-buffer.test.ts`

| Test | What it verifies |
|------|-----------------|
| `writes a string at given position` | `write()` + `diff()` produces ANSI output containing the written chars |
| `clips writes outside bounds` | Out-of-bounds writes don't throw; buffer stays intact |
| `clone produces independent copy` | Mutating original after `clone()` doesn't affect the clone |
| `diff returns empty string when buffers are identical` | No ANSI output when no cells changed |

**Run:**
```bash
$ npm test
```

**Not yet tested:**
- `CellBuffer.flush()` (full repaint path)
- `CellBuffer.fill()` (rectangle fill)
- `computeLayout()` and `drawBorder()` (layout engine)
- `parseKey()` (keyboard parser)
- `runDoctor()` (requires filesystem mocking)
- `App` class (requires a real or mocked TTY)

---

## Known limitations

- **Mouse events are parsed but not dispatched.** `App.listenInput()` drops mouse input bytes (`\033[<` prefix) — the SGR mouse parser (`src/tui/input/mouse.ts`) is stubbed for Wave 2.
- **Panels are static placeholders.** `SessionPanel`, `OrchestrationCanvas`, `AgentsPanel`, and `TerminalPanel` render placeholder text only — full implementations arrive in Waves 1–4.
- **VT100 passthrough is absent.** `TerminalPanel` has no `node-pty` integration in Wave 0.
- **No Claude API connection.** `agent-loop.ts` is not present; the API key check in `doctor` is informational only.
- **`factory doctor` token check always fails** unless `~/.agentfactory/token` has been manually created. This is expected — registry auth is Wave 5.
- **Test coverage is limited to `CellBuffer`.** The layout, input, and doctor modules have zero test coverage in Wave 0; Wave 1 should add them.
