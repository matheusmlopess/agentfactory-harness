<!-- version: 1.0.0 -->
# Feature: Wave 4 — TerminalPanel / PTY Embed

╔══════════════════════════════════════════════════════════════════════════════╗
║  WAVE   4                                                                    ║
║  FILES  src/tui/input/vt.ts · src/tui/panels/TerminalPanel.ts               ║
║         src/tui/renderer/layout.ts (extended) · src/app.ts (extended)       ║
║  TESTS  148 passing (19 test files)                                          ║
║  KEY    F4 / Tab to switch · F1–F3 to leave · Ctrl+Q always quits           ║
╚══════════════════════════════════════════════════════════════════════════════╝

───────────────────────────────────────────────────────────────────────────────
## 1. WHAT IT DOES
───────────────────────────────────────────────────────────────────────────────

Wave 4 embeds a real interactive shell inside the `factory` TUI. Pressing F4 (or
Tab-cycling to "Terminal") switches the right column from the Orchestration/Agents
view to a full PTY session. Keystrokes go to the shell; shell output renders in
the existing cell-buffer with full ANSI colour and cursor support.

  ┌───────────────────────────────────────────────────────────────────────────┐
  │  Before Wave 4 (3 tabs)           After Wave 4 (4 tabs)                  │
  │  ──────────────────────           ─────────────────────                  │
  │  F1  Session                      F1  Session                            │
  │  F2  Orchestration                F2  Orchestration                      │
  │  F3  Agents                       F3  Agents                             │
  │                                   F4  Terminal   ← NEW                   │
  └───────────────────────────────────────────────────────────────────────────┘

───────────────────────────────────────────────────────────────────────────────
## 2. ARCHITECTURE
───────────────────────────────────────────────────────────────────────────────

  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  factory — Wave 4 Terminal Layer                                         ║
  ║                                                                          ║
  ║  ┌──────────────────────────────────────────────────────────────────┐    ║
  ║  │  App.listenInput()  (src/app.ts)                                 │    ║
  ║  │                                                                  │    ║
  ║  │  stdin raw bytes                                                 │    ║
  ║  │    │                                                             │    ║
  ║  │    ├─ activeTab ≠ 3 ──► parseMouse / parseKey ──► router        │    ║
  ║  │    │                                                             │    ║
  ║  │    └─ activeTab = 3 ─────────────────────────────────────────►  │    ║
  ║  │         │  Ctrl+Q        → App.stop()                           │    ║
  ║  │         │  F1/F2/F3/F4   → switch tab (raw byte patterns)       │    ║
  ║  │         └─ everything else → TerminalPanel.write(data)          │    ║
  ║  └──────────────────────────────────────────────────────────────────┘    ║
  ║                          │                                                ║
  ║                          ▼                                                ║
  ║  ┌──────────────────────────────────────────────────────────────────┐    ║
  ║  │  TerminalPanel  (src/tui/panels/TerminalPanel.ts)                │    ║
  ║  │                                                                  │    ║
  ║  │  constructor(rect, scheduleRender)                               │    ║
  ║  │    └── pty.spawn(SHELL, [], { cols, rows, xterm-256color })      │    ║
  ║  │          ├── onData(chunk) ──► VTScreen.feed(chunk)              │    ║
  ║  │          │                    scheduleRender()                   │    ║
  ║  │          └── onExit()     ──► alive=false, scheduleRender()      │    ║
  ║  │                                                                  │    ║
  ║  │  write(buf)  ──► pty.write(buf.toString('binary'))               │    ║
  ║  │  resize(r,c) ──► screen.resize(r,c); pty.resize(c,r)            │    ║
  ║  │  destroy()   ──► pty.kill()  (idempotent)                       │    ║
  ║  │  render(buf) ──► screen.render(buf, this.inner)                 │    ║
  ║  └──────────────────────────────────────────────────────────────────┘    ║
  ║                          │                                                ║
  ║                          ▼                                                ║
  ║  ┌──────────────────────────────────────────────────────────────────┐    ║
  ║  │  VTScreen  (src/tui/input/vt.ts)                                 │    ║
  ║  │                                                                  │    ║
  ║  │  Internal: rows×cols VTCell[][] grid + VTStyle cursor state      │    ║
  ║  │                                                                  │    ║
  ║  │  feed(data: string)                                              │    ║
  ║  │    ├── state=normal  → handleChar (printable/CR/LF/BS)          │    ║
  ║  │    ├── state=escape  → detect [ (CSI) or ] (OSC)                │    ║
  ║  │    ├── state=csi     → accumulate until final byte 0x40–0x7e    │    ║
  ║  │    │     └── handleCSI(params, final):                          │    ║
  ║  │    │           m(SGR) H/f(CUP) A–D(CU*) G(CHA) d(VPA)         │    ║
  ║  │    │           J(ED) K(EL) — all others ignored                 │    ║
  ║  │    └── state=osc     → accumulate until BEL — ignored          │    ║
  ║  │                                                                  │    ║
  ║  │  render(buf, inner: Rect)                                        │    ║
  ║  │    └── for each cell → buf.write(inner.row+r, inner.col+c, ...)  │    ║
  ║  └──────────────────────────────────────────────────────────────────┘    ║
  ║                          │                                                ║
  ║                          ▼                                                ║
  ║             CellBuffer.diff(prev) ──► process.stdout                     ║
  ╚══════════════════════════════════════════════════════════════════════════╝

───────────────────────────────────────────────────────────────────────────────
## 3. PROJECT STRUCTURE — BEFORE vs AFTER
───────────────────────────────────────────────────────────────────────────────

  BEFORE (Wave 3.5)                    AFTER (Wave 4)
  ─────────────────────────────────    ──────────────────────────────────────
  src/tui/
  ├── input/                           ├── input/
  │   ├── keyboard.ts                  │   ├── keyboard.ts
  │   ├── mouse.ts                     │   ├── mouse.ts
  │   └── router.ts                    │   ├── router.ts
  │                                    │   ├── vt.ts          ← NEW
  │                                    │   └── vt.test.ts     ← NEW
  ├── panels/                          ├── panels/
  │   ├── Panel.ts                     │   ├── Panel.ts
  │   ├── StatusBar.ts                 │   ├── StatusBar.ts
  │   ├── SessionPanel.ts              │   ├── SessionPanel.ts
  │   ├── OrchestrationCanvas.ts       │   ├── OrchestrationCanvas.ts
  │   └── AgentsPanel.ts              │   ├── AgentsPanel.ts
  │                                    │   ├── TerminalPanel.ts  ← NEW
  │                                    │   └── TerminalPanel.test.ts ← NEW
  └── renderer/                        └── renderer/
      ├── ansi.ts                           ├── ansi.ts
      ├── cell-buffer.ts                    ├── cell-buffer.ts
      ├── layout.ts    ← MODIFIED           ├── layout.ts   PanelLayout +terminal
      └── theme.ts                          └── theme.ts

  src/app.ts            ← MODIFIED     4th tab, F4, PTY bypass, destroy/resize

  Changes summary:
    + src/tui/input/vt.ts             VTScreen ANSI parser (344 lines)
    + src/tui/input/vt.test.ts        27 VTScreen unit tests
    + src/tui/panels/TerminalPanel.ts node-pty wrapper panel (82 lines)
    + src/tui/panels/TerminalPanel.test.ts  7 lifecycle tests
    ~ src/tui/renderer/layout.ts      PanelLayout: + terminal: Rect
    ~ src/app.ts                      4th tab, raw input bypass, resize, destroy

───────────────────────────────────────────────────────────────────────────────
## 4. LAYOUT CHANGE
───────────────────────────────────────────────────────────────────────────────

  computeLayout() now returns 6 rects instead of 5:

  PanelLayout (before)               PanelLayout (after)
  ─────────────────────              ─────────────────────────────────────────
  tabBar    (row 0)                  tabBar    (row 0)
  session   (40% left)               session   (40% left)
  canvas    (60% right, top 70%)     canvas    (60% right, top 70%)
  agents    (60% right, bot 30%)     agents    (60% right, bot 30%)
  statusBar (last row)               terminal  (60% right, FULL height) ← NEW
                                     statusBar (last row)

  terminal shares the same (col, width) as canvas, but spans the full
  mainHeight — same bounding box as canvas+agents combined.

  Rendering is conditional:

    activeTab ∈ {0,1,2}  →  draw canvas + agents panels (unchanged)
    activeTab = 3         →  draw terminal panel instead (overlaps same cols)

  No pixel coordinates change for Session or StatusBar — they are unaffected.

───────────────────────────────────────────────────────────────────────────────
## 5. INPUT ROUTING — BEFORE vs AFTER
───────────────────────────────────────────────────────────────────────────────

  BEFORE (all tabs):
  ──────────────────
  stdin data
    → parseMouse()?  yes → router.dispatch(mouse)
    → parseKey()?    yes → app-level hotkeys (Ctrl+Q, Tab, F1–F3, Ctrl+R)
                         → router.dispatch(key, panels, activeTab)

  AFTER (tab 0-2 unchanged; tab 3 new path):
  ───────────────────────────────────────────
  stdin data
    ┌─ activeTab ≠ 3 ─────────────────────────────────────────────────────────┐
    │  same as before: parseMouse / parseKey / router                         │
    └──────────────────────────────────────────────────────────────────────────┘
    ┌─ activeTab = 3  (Terminal focused) ─────────────────────────────────────┐
    │  data[0] === 0x11        → App.stop()           (Ctrl+Q always works)   │
    │  data === '\x1bOP'       → activeTab=0, render  (F1)                    │
    │  data === '\x1bOQ'       → activeTab=1, render  (F2)                    │
    │  data === '\x1bOR'       → activeTab=2, render  (F3)                    │
    │  data === '\x1bOS'       → no-op                (F4 — already here)     │
    │  anything else           → terminalPanel.write(data)  ← raw forward     │
    └──────────────────────────────────────────────────────────────────────────┘

  Key design decision: Tab key (0x09) is forwarded to the PTY when Terminal
  is active. Shells use Tab for completion — stealing it would break bash/zsh.
  Tab-cycling only works via F1–F4 when Terminal is focused.

───────────────────────────────────────────────────────────────────────────────
## 6. VTScreen ANSI SUPPORT MATRIX
───────────────────────────────────────────────────────────────────────────────

  ┌─────────────────────────────────────────────────────────────────────────┐
  │  SUPPORTED                                                              │
  ├───────────┬─────────────────────────────────────────────────────────────┤
  │  Text     │  All printable UTF-8 characters; soft-wrap at col boundary  │
  │  CR       │  \r — cursor column → 0                                     │
  │  LF       │  \n — cursor row++; scroll grid if at bottom row            │
  │  BS       │  \x08 — cursor column--                                     │
  │  CUP      │  CSI H / f — set cursor row,col (1-based)                   │
  │  CUU/D    │  CSI A/B — cursor up/down N rows                            │
  │  CUF/B    │  CSI C/D — cursor forward/back N cols                       │
  │  CHA      │  CSI G — cursor to column N (1-based)                       │
  │  VPA      │  CSI d — cursor to row N (1-based)                          │
  │  ED 0     │  CSI 0J — erase from cursor to display end                  │
  │  ED 1     │  CSI 1J — erase from display start to cursor                │
  │  ED 2/3   │  CSI 2J / 3J — erase entire display                        │
  │  EL 0     │  CSI 0K — erase from cursor to line end                     │
  │  EL 1     │  CSI 1K — erase from line start to cursor                   │
  │  EL 2     │  CSI 2K — erase entire line                                 │
  │  SGR 0    │  Reset all attributes                                        │
  │  SGR 1/2  │  Bold / dim                                                  │
  │  SGR 4    │  Underline                                                    │
  │  SGR 7    │  Reverse video                                               │
  │  SGR 30–37│  Standard 8-colour foreground                               │
  │  SGR 40–47│  Standard 8-colour background                               │
  │  SGR 90–97│  Bright 8-colour foreground                                  │
  │  SGR 100–107 Bright 8-colour background                                 │
  │  SGR 38;5;N  256-colour foreground                                       │
  │  SGR 48;5;N  256-colour background                                       │
  │  SGR 38;2;R;G;B  Truecolour fg (approximated to xterm-256)             │
  │  SGR 48;2;R;G;B  Truecolour bg (approximated to xterm-256)             │
  │  SGR 39/49   Reset fg / bg                                              │
  │  OSC       │  Ignored (title sequences don't corrupt output)            │
  ├───────────┴─────────────────────────────────────────────────────────────┤
  │  NOT SUPPORTED (silently ignored)                                        │
  ├─────────────────────────────────────────────────────────────────────────┤
  │  Alternate screen (CSI ?1049h/l) — stays on VTScreen's single buffer    │
  │  Scroll regions (CSI r / DECSTBM)                                       │
  │  Insert/delete line (CSI L / M)                                          │
  │  Insert/delete char (CSI @ / P)                                          │
  │  Mouse tracking enable/disable from PTY side                            │
  │  Bracketed paste mode                                                    │
  │  Cursor shape sequences                                                  │
  └─────────────────────────────────────────────────────────────────────────┘

───────────────────────────────────────────────────────────────────────────────
## 7. WORKFLOW WALK-THROUGHS
───────────────────────────────────────────────────────────────────────────────

### 7.1  Happy path — user opens terminal and runs a command

  factory launches → initPanels() → TerminalPanel constructed
     │
     ├── pty.spawn('bash', [], { cols:58, rows:22, xterm-256color })
     ├── pty.onData registered (feeds VTScreen)
     └── pty.onExit registered

  User presses F4
     │
     ├── activeTab = 3
     └── render(): draws Terminal border, terminalPanel.render(buf)
           └── VTScreen.render(): bash prompt painted into cells

  User types "ls -la" + Enter
     │
     ├── each keystroke: listenInput raw bypass → terminalPanel.write(data)
     │     └── pty.write("l") / pty.write("s") / … / pty.write("\r")
     ├── PTY echoes "ls -la\r\n" → pty.onData → VTScreen.feed → scheduleRender
     └── directory listing streamed back:
           each onData chunk → VTScreen.feed → scheduleRender → render()

  User presses F1 to return to Session
     │
     ├── raw byte '\x1bOP' detected in listenInput
     ├── activeTab = 0
     └── render(): Session + Orchestration + Agents drawn (terminal hidden)

### 7.2  Terminal resize

  User resizes physical terminal window
     │
     ├── process.stdout fires 'resize'
     ├── rows/cols updated, new CellBuffer pair allocated
     ├── computeLayout() recalculates all rects
     ├── terminalPanel.rect = layout.terminal
     ├── inner = { height: mainHeight-2, width: rightWidth-2 }
     ├── terminalPanel.resize(inner.height, inner.width)
     │     ├── screen.resize(rows, cols) — grid expanded/contracted, cells kept
     │     └── pty.resize(cols, rows)   — PTY sigwinch sent to shell
     └── render() — shell reflows its output (e.g. ls redraws columns)

### 7.3  Shell exits inside the terminal

  User types "exit" in the terminal panel
     │
     ├── pty sends 'exit' to bash → bash exits
     ├── pty.onExit fires → alive = false, scheduleRender()
     └── render(): terminalPanel.render(buf)
           └── "[terminal exited — press F1–F3 to switch panel]" shown in dim

  User presses F1 to continue working elsewhere:
     ├── activeTab = 0
     └── Session panel rendered; TerminalPanel left in dead state

  Ctrl+Q:
     ├── App.stop() → terminalPanel.destroy() (pty.kill is no-op since dead)
     └── exit 0

### 7.4  Ctrl+Q quits from any tab

  Whether in Session, Orchestration, Agents, or Terminal:
     │
     ├── Tab 0–2: parseKey returns ctrl+q → App.stop()
     └── Tab 3:   raw data[0] === 0x11   → App.stop() (Ctrl+Q = 0x11)

  App.stop():
    1. terminalPanel.destroy() — SIGTERM to PTY
    2. stdin.removeAllListeners('data')
    3. stdin.setRawMode(false)
    4. stdin.pause()
    5. stdout.write(disableMouse + showCursor + exitAltScreen, () => exit(0))

### 7.5  Rapid output (e.g. find / or cat large file)

  PTY emits many onData chunks in rapid succession:
     │
     ├── each chunk: VTScreen.feed(chunk) [synchronous, no I/O]
     ├── scheduleRender() called — but renderPending flag coalesces frames
     │     └── only ONE setImmediate render per event-loop tick
     └── terminal renders at ~60fps even under flood conditions
           (no frame-flood crash — same mechanism that fixed PR #13)

───────────────────────────────────────────────────────────────────────────────
## 8. END-TO-END TEST PLAN
───────────────────────────────────────────────────────────────────────────────

### Preconditions
  • Node.js ≥ 20 (node-pty requires it)
  • `npm run build` succeeds (no TypeScript errors)
  • Terminal emulator: xterm-compatible, ≥ 80×24, SGR mouse, UTF-8
  • SHELL environment variable set (or bash available at /bin/bash)

### T1 — Terminal tab activation

  Steps:
    1. factory
    2. Press F4

  Expected:
    • Tab bar shows "Terminal" highlighted (4th tab)
    • Right column replaces canvas/agents with a bordered "Terminal" panel
    • Shell prompt visible inside the panel (e.g. "$ " or "user@host:~$")
    • Session panel still visible on the left

  Validation: prompt is rendered, no blank screen, no error in status bar.

### T2 — Typing in the terminal

  Steps:
    1. factory → F4
    2. Type "echo hello world" and press Enter

  Expected:
    • Characters appear at the shell prompt as typed
    • After Enter: "hello world" appears on the next line
    • Cursor advances correctly

  Validation: output text visible in the terminal panel cells.

### T3 — Tab key forwarded to shell (not switching panels)

  Steps:
    1. factory → F4
    2. Type "ls /et" (without Enter)
    3. Press Tab

  Expected:
    • "ls /etc" auto-completed by bash (NOT panel switch)
    • Still on Terminal tab

  Validation: Tab completion works; no tab switch occurred.

### T4 — F1–F3 switch away from Terminal

  Steps:
    1. factory → F4 (on Terminal)
    2. Press F1

  Expected:
    • Panel switches to Session tab
    • Canvas + Agents visible in right column again
    • PTY still running (not killed)

  Steps (resume):
    3. Press F4

  Expected:
    • Terminal panel reappears with PTY still alive and prompt visible

### T5 — Ctrl+Q quits from Terminal tab

  Steps:
    1. factory → F4
    2. Type a partial command (e.g. "sl")
    3. Press Ctrl+Q (not Enter)

  Expected:
    • App exits cleanly (alt-screen restored, cursor shown)
    • No raw-mode artifact in shell after exit

  Validation: shell prompt returns cleanly.

### T6 — Terminal resize

  Steps:
    1. factory → F4
    2. Run "ls -la" in the shell
    3. Resize the terminal window (drag or `resize` command in outer shell)

  Expected:
    • Terminal panel reflows immediately
    • Shell redraws to new dimensions (bash re-runs COLUMNS/LINES)
    • No crash, no garbage characters

### T7 — Shell exit handling

  Steps:
    1. factory → F4
    2. Type "exit" and press Enter

  Expected:
    • "terminal exited — press F1–F3 to switch panel" message appears in dim
    • No crash; app still running
    • F1 switches to Session panel normally

### T8 — ANSI colour rendering

  Steps:
    1. factory → F4
    2. Type "ls --color=always" and press Enter (Linux) or
       "ls -G" (macOS)

  Expected:
    • Directories appear in one colour (typically blue/cyan)
    • Executables in another (typically green)
    • Colours rendered correctly in the cell-buffer

### T9 — Rapid output does not crash

  Steps:
    1. factory → F4
    2. Type "find /usr -name '*.js' 2>/dev/null" and press Enter

  Expected:
    • Many lines stream through without terminal crash
    • scheduleRender coalesces frames (no flooding)
    • App remains responsive; Ctrl+Q exits cleanly

### Common failure indicators

  ┌──────────────────────────────┬────────────────────────────────────────────┐
  │  Symptom                     │  Likely cause                              │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │  Blank terminal panel        │  SHELL env var not set; pty.spawn failed   │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │  Garbled characters          │  TERM not xterm-compatible, or truecolour  │
  │                              │  RGB SGR not approximated correctly        │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │  Tab switches panel instead  │  Tab byte (0x09) not being forwarded       │
  │  of completing               │  (regression in raw bypass check)          │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │  Ctrl+Q does not exit        │  0x11 byte check missing or wrong offset   │
  │  from Terminal tab           │                                            │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │  Shell exits but panel       │  onExit handler not calling scheduleRender │
  │  still shows live cursor     │                                            │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │  Resize causes crash         │  pty.resize called before panel rect set   │
  ├──────────────────────────────┼────────────────────────────────────────────┤
  │  Raw mode stuck after exit   │  App.stop() did not run — SIGKILL received │
  │                              │  or uncaught exception before cleanup      │
  └──────────────────────────────┴────────────────────────────────────────────┘

───────────────────────────────────────────────────────────────────────────────
## 9. DESIGN REASONING & TRADE-OFFS
───────────────────────────────────────────────────────────────────────────────

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Decision                     │  Rationale / Trade-off                   │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  VTScreen instead of xterm.js │  No DOM dependency; integrates with the  │
  │  or node-ansiterminal         │  existing CellBuffer without a bridge     │
  │                               │  layer. Trade-off: hand-rolled parser     │
  │                               │  may miss obscure sequences.             │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  terminal rect = full right   │  Avoids adding a 5th layout slot; the    │
  │  column (overlays canvas+     │  terminal replaces canvas+agents — they  │
  │  agents, not additive)        │  can't coexist. Trade-off: no split-view │
  │                               │  (terminal + canvas side by side).       │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Raw-byte bypass for PTY      │  parseKey() strips mouse bytes and drops  │
  │  input when tab=3             │  sequences it doesn't recognise. Shells   │
  │                               │  need raw bytes (readline, vi, tmux).    │
  │                               │  Trade-off: app-level shortcuts (Ctrl+R)  │
  │                               │  are not interceptable in terminal mode. │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  F1–F3 detected via raw bytes │  When terminal is active, parseKey is    │
  │  (\x1bOP/Q/R/S patterns)      │  bypassed, so key.key values are never   │
  │                               │  produced. Raw F-key patterns are        │
  │                               │  xterm-standard. Trade-off: terminal     │
  │                               │  emulators with non-standard F-key       │
  │                               │  sequences (e.g. PuTTY) may not work.   │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Single PTY per session       │  Simple and sufficient for Wave 4 scope. │
  │                               │  Trade-off: no multi-pane split terminal. │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Truecolour RGB → 256 approx  │  CellBuffer style uses palette indices   │
  │                               │  (number | undefined). 24-bit RGB cannot │
  │                               │  be stored natively without API change.  │
  │                               │  Trade-off: slight colour inaccuracy on  │
  │                               │  truecolour terminal prompts (e.g.       │
  │                               │  Starship, Powerlevel10k).               │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  scheduleRender coalescing    │  Same pattern as SessionPanel — prevents  │
  │                               │  flood renders on high-output commands.  │
  │                               │  Trade-off: one event-loop tick latency  │
  │                               │  between PTY output and screen update.   │
  └──────────────────────────────────────────────────────────────────────────┘

### Assumptions

  • Shell is xterm-compatible (TERM=xterm-256color set on spawn).
  • PTY output is UTF-8; multi-byte characters occupy one cell (no wide-char
    handling — CJK or emoji may render as single-width).
  • F-key escape sequences match xterm application mode: \x1bOP–\x1bOS (F1–F4).
  • The physical terminal running factory supports SGR mouse (for panels 1–3);
    the PTY inside the Terminal panel does not re-enable mouse tracking.
  • node-pty is a native addon compiled for the host Node version.

───────────────────────────────────────────────────────────────────────────────
## 10. IDENTIFIED GAPS & RISKS
───────────────────────────────────────────────────────────────────────────────

  CRITICAL
  ─────────
  VT-GAP-01  Wide characters (CJK, emoji) are written as a single cell but
             may be two columns wide in the physical terminal, causing a
             one-column render offset for the rest of the line.
             Fix (short-term): after writing a wide char, increment col by 2
             and write a blank cell at col+1 as a placeholder.

  VT-GAP-02  Alternate screen mode (CSI ?1049h/l) is ignored. Programs that
             use alternate screen (vim, less, htop) will write over the primary
             screen and leave artefacts when they exit.
             Fix (short-term): track alt-screen flag; maintain a second
             VTCell[][] grid and swap grids on mode change.

  HIGH
  ────
  VT-GAP-03  Scroll regions (CSI r / DECSTBM) are not implemented. Programs
             like less and man that use partial-screen scrolling will render
             incorrectly — lines scroll the full screen instead of a region.
             Fix (short-term): add scrollTop/scrollBottom state to VTScreen;
             adjust scrollUp() to only shift the bounded region.

  VT-GAP-04  F-key escape sequences are matched against xterm Application Key
             mode patterns (\x1bOP–\x1bOS). Terminal emulators using VT100
             mode (\x1b[11~–\x1b[14~) or PuTTY mode will not trigger tab
             switching while in Terminal tab.
             Fix (short-term): match both xterm and VT100 F-key patterns.

  VT-GAP-05  Mouse events from process.stdin are not suppressed before
             forwarding to the PTY when Terminal tab is active. If a mouse
             click arrives while activeTab=3, it is forwarded raw to the PTY,
             which may interpret it unexpectedly if it has mouse tracking on.
             Fix (short-term): filter out SGR mouse sequences (\x1b[<...) in
             the raw-bypass path before writing to pty.

  MEDIUM
  ───────
  VT-GAP-06  No scrollback buffer. Output that scrolls past the top of the
             VTScreen is permanently lost.

  VT-GAP-07  Truecolour (24-bit RGB) SGR is approximated to xterm-256 palette.
             Prompts using Starship or Powerlevel10k may show slightly wrong
             colours.

  VT-GAP-08  TerminalPanel is created in App.initPanels() and spawns a shell
             immediately, even if the user never switches to the Terminal tab.
             A shell process is always running in the background.
             Fix (short-term): lazy-spawn — create TerminalPanel on first F4
             press rather than at startup.

  VT-GAP-09  If node-pty native addon is not built (e.g. after `npm install`
             without a build step), TerminalPanel constructor throws at
             import time, crashing the entire App.
             Fix (short-term): wrap pty.spawn in a try/catch; show an error
             banner in the panel if PTY unavailable.

───────────────────────────────────────────────────────────────────────────────
## 11. POTENTIAL ENHANCEMENTS
───────────────────────────────────────────────────────────────────────────────

  SHORT-TERM (before Wave 5)
  ──────────────────────────
  • VT-GAP-02: Alternate screen mode (vim, htop, less support)
  • VT-GAP-03: Scroll regions (man pages, less)
  • VT-GAP-04: VT100 F-key pattern fallback
  • VT-GAP-05: Filter mouse SGR bytes in raw-bypass path
  • VT-GAP-08: Lazy PTY spawn on first F4 press
  • VT-GAP-09: Graceful PTY unavailable error in panel
  • Cursor visibility: honour CSI ?25l/h (hide/show cursor from PTY side)

  LONG-TERM (Wave 5+)
  ───────────────────
  • VT-GAP-01: Wide-character (CJK/emoji) double-cell rendering
  • VT-GAP-06: Scrollback buffer (configurable N lines, Shift+PgUp/PgDn)
  • Multiple PTY panes (horizontal/vertical split)
  • Clipboard integration: copy selection from terminal panel
  • Mouse forwarding to PTY (click-to-position cursor in editors)
  • Session persistence: reconnect to a detached PTY on restart (via tmux/dtach)
  • Shell indicator in StatusBar (current dir / git branch from PTY cwd)

───────────────────────────────────────────────────────────────────────────────
## 12. DOCUMENTATION TRACKING AUDIT
───────────────────────────────────────────────────────────────────────────────

  ┌──────────────────────────────────────────────────┬──────────┬───────────┐
  │  Document                                        │  Status  │  Notes    │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  docs/features/FEATURE-WAVE-4-TERMINAL-PANEL.md  │  ✓ new   │  this file│
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  docs/features/FEATURE-SYSTEM-ARCHITECTURE-      │  ✓ cur   │  needs W4 │
  │    v0.4.0.md                                     │          │  section  │
  │                                                  │          │  after    │
  │                                                  │          │  merge    │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  specs/docs/approvedPlans/                       │  ✓ cur   │           │
  │    2026-05-18-wave-4-terminal-panel.md           │          │           │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  .ai/project-index.yml                           │  ✓ cur   │  v1.5.0   │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  .ai/memory/milestones.md                        │  PENDING │  W4 row   │
  │                                                  │          │  needs    │
  │                                                  │          │  status → │
  │                                                  │          │  ✓ done   │
  │                                                  │          │  on merge │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  README.md                                       │  PENDING │  wave     │
  │                                                  │          │  table:   │
  │                                                  │          │  W4       │
  │                                                  │          │  planned  │
  │                                                  │          │  → ✓ done │
  │                                                  │          │  on merge │
  └──────────────────────────────────────────────────┴──────────┴───────────┘

  Post-merge checklist:
    □ milestones.md: W4 row → ✓ done, branch/commit/tag filled
    □ README.md: wave table W4 "planned" → "✓ done"
    □ FEATURE-SYSTEM-ARCHITECTURE-v0.4.0.md: add TerminalPanel to
      component reference and 4th tab to workflow walk-throughs
    □ Security review update: TerminalPanel PTY attack surface (Wave 5)

  Review enforcement (per .ai/rules/doc-before-commit.md):
    • This doc committed alongside the feature code in the same branch.
    • project-index.yml updated in the same commit (Rule 8).
    • Version marker present (<!-- version: 1.0.0 -->).
    • Approved plan already in specs/docs/approvedPlans/ (Rule 1).

───────────────────────────────────────────────────────────────────────────────
## 13. INFRASTRUCTURE CONFIGURATION AUDIT
───────────────────────────────────────────────────────────────────────────────

  ╔══════════════════════════════════════════════════════════════════╗
  ║  Docker Compose   NOT PRESENT — no change needed for Wave 4      ║
  ║  Ansible          NOT PRESENT — no change needed for Wave 4      ║
  ║  CI/CD            NOT PRESENT — INFRA-01 gap still open          ║
  ╚══════════════════════════════════════════════════════════════════╝

  Wave 4 adds a native addon dependency (node-pty) that has compile-time
  implications for deployment environments:

  INFRA-W4-01  node-pty requires native compilation (node-gyp) at npm install.
               On bare machines this needs python3, make, and a C++ compiler.
               On Docker: use a node image with build-essential, or pre-build
               with `npm rebuild node-pty` in the image layer.
               Fix: add to any future Dockerfile —
                 RUN apt-get install -y python3 make g++ && npm ci

  INFRA-W4-02  npm publish of agentfactory-harness will include node-pty as a
               dependency. Binary addons are platform-specific; end users on
               macOS/Windows need compilation tools or prebuilt binaries.
               Fix: add node-pty to optionalDependencies and handle PTY
               unavailability gracefully (VT-GAP-09).

  INFRA-W4-03  If CI is added (INFRA-01), tests must run with a PTY available.
               node-pty tests require a real TTY allocation — standard CI
               runners (GitHub Actions ubuntu-latest) support this.
               The TerminalPanel tests use a vi.mock so no real PTY is needed.
