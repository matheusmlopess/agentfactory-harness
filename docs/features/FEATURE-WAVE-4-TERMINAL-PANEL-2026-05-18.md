<!-- version: 1.1.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-05-18 -->
<!-- last-updated: 2026-06-19 -->
# Feature: Wave 4 — TerminalPanel / PTY Embed + Mouse Navigation

╔══════════════════════════════════════════════════════════════════════════════╗
║  WAVE    4                                                                   ║
║  FILES   src/tui/input/vt.ts · src/tui/panels/TerminalPanel.ts              ║
║          src/tui/renderer/layout.ts (extended) · src/app.ts (extended)      ║
║  TESTS   155 passing (19 test files)                                         ║
║  KEY     Click tab labels · F4 to enter · F1–F3 to leave · Ctrl+Q quits     ║
║  STATUS  ✓ complete — PR #15                                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

───────────────────────────────────────────────────────────────────────────────
## 1. WHAT IT DOES
───────────────────────────────────────────────────────────────────────────────

Wave 4 adds two major capabilities to the `factory` TUI:

  1. TERMINAL PANEL — a real interactive shell (via node-pty) embedded in the
     right column of the UI. Pressing F4 or clicking the Terminal tab replaces
     the Orchestration/Agents view with a full PTY session. Keystrokes go to
     the shell; shell output renders in the cell-buffer with full ANSI colour,
     cursor positioning, alternate screen, and scroll-region support.

  2. MOUSE NAVIGATION — every tab label in the top bar and every panel body
     is now clickable. Clicking a tab switches to it; clicking inside a panel
     focuses it. This works from all tabs including Terminal.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Before Wave 4 (3 tabs, keyboard-only)                                   │
  │  ─────────────────────────────────────                                   │
  │  F1  Session                                                             │
  │  F2  Orchestration                                                       │
  │  F3  Agents                                                              │
  │                                                                          │
  │  After Wave 4 (4 tabs, keyboard + mouse)                                 │
  │  ────────────────────────────────────────                                │
  │  F1 / click  Session                                                     │
  │  F2 / click  Orchestration                                               │
  │  F3 / click  Agents                                                      │
  │  F4 / click  Terminal  ← NEW                                             │
  │  click panel body      → focus that panel directly                       │
  └──────────────────────────────────────────────────────────────────────────┘

───────────────────────────────────────────────────────────────────────────────
## 2. ARCHITECTURE
───────────────────────────────────────────────────────────────────────────────

  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  factory — Wave 4 Terminal Layer                                         ║
  ║                                                                          ║
  ║  ┌──────────────────────────────────────────────────────────────────┐   ║
  ║  │  App.listenInput()  (src/app.ts)                                 │   ║
  ║  │                                                                  │   ║
  ║  │  stdin raw bytes                                                 │   ║
  ║  │    │                                                             │   ║
  ║  │    ├─ activeTab ≠ 3 ─────────────────────────────────────────►  │   ║
  ║  │    │    parseMouse()?                                            │   ║
  ║  │    │      left-press row=0  → tabAt(col) → switch tab           │   ║
  ║  │    │      left-press body   → panelTabAt → focus panel          │   ║
  ║  │    │      any mouse         → router.dispatch(mouse)            │   ║
  ║  │    │    parseKey()?                                              │   ║
  ║  │    │      Ctrl+Q/C         → App.stop()                         │   ║
  ║  │    │      Tab              → next tab (cycling)                  │   ║
  ║  │    │      F1–F4            → switch tab                         │   ║
  ║  │    │      Ctrl+R           → runPlan()                          │   ║
  ║  │    │      other            → router.dispatch(key)               │   ║
  ║  │    │                                                             │   ║
  ║  │    └─ activeTab = 3  (Terminal focused) ─────────────────────►  │   ║
  ║  │         data[0] = 0x11   → App.stop()           (Ctrl+Q)        │   ║
  ║  │         '\x1bOP/[11~'    → activeTab=0           (F1)           │   ║
  ║  │         '\x1bOQ/[12~'    → activeTab=1           (F2)           │   ║
  ║  │         '\x1bOR/[13~'    → activeTab=2           (F3)           │   ║
  ║  │         '\x1bOS/[14~'    → no-op                 (F4 here)      │   ║
  ║  │         '\x1b[<...'      → parse: tab-bar click? switch         │   ║
  ║  │                            else suppress (no PTY forwarding)    │   ║
  ║  │         all else          → TerminalPanel.write(data)  (raw)   │   ║
  ║  └──────────────────────────────────────────────────────────────────┘   ║
  ║                          │                                                ║
  ║                          ▼                                                ║
  ║  ┌──────────────────────────────────────────────────────────────────┐   ║
  ║  │  TerminalPanel  (src/tui/panels/TerminalPanel.ts)                │   ║
  ║  │                                                                  │   ║
  ║  │  constructor(rect, scheduleRender)  — lazy, try/catch spawn      │   ║
  ║  │    └── pty.spawn(SHELL, [], { cols, rows, xterm-256color })      │   ║
  ║  │          ├── onData(chunk) ──► VTScreen.feed(chunk)              │   ║
  ║  │          │                    scheduleRender()                   │   ║
  ║  │          └── onExit()     ──► alive=false, scheduleRender()      │   ║
  ║  │                                                                  │   ║
  ║  │  render(buf)  ──► error banner | exit banner | screen.render()  │   ║
  ║  │  write(data)  ──► pty.write(data.toString('binary'))            │   ║
  ║  │  resize(r,c)  ──► screen.resize(r,c); pty.resize(c,r)          │   ║
  ║  │  destroy()    ──► pty.kill()  (idempotent)                      │   ║
  ║  └──────────────────────────────────────────────────────────────────┘   ║
  ║                          │                                                ║
  ║                          ▼                                                ║
  ║  ┌──────────────────────────────────────────────────────────────────┐   ║
  ║  │  VTScreen  (src/tui/input/vt.ts)                                 │   ║
  ║  │                                                                  │   ║
  ║  │  Internal state:                                                  │   ║
  ║  │    grid:         VTCell[][] — rows×cols primary buffer           │   ║
  ║  │    altGrid:      VTCell[][] | null — alternate screen buffer     │   ║
  ║  │    style:        VTStyle — current SGR accumulator               │   ║
  ║  │    curRow/curCol: number — cursor position (0-based)             │   ║
  ║  │    scrollTop/scrollBottom: number — DECSTBM region               │   ║
  ║  │    cursorVisible: boolean — CSI ?25h/l state                    │   ║
  ║  │    state:        ParseState — normal|escape|csi|osc              │   ║
  ║  │    seqBuf:       string — accumulator for CSI/OSC params         │   ║
  ║  │    privateMode:  boolean — CSI ? prefix detected                 │   ║
  ║  │                                                                  │   ║
  ║  │  feed(data: string)                                              │   ║
  ║  │    ├── state=normal  → handleChar (printable/CR/LF/BS/BEL)      │   ║
  ║  │    ├── state=escape  → detect [ (CSI) or ] (OSC)                │   ║
  ║  │    ├── state=csi     → accumulate → handleCSI(params, final)    │   ║
  ║  │    │     private h/l: 25(cursor vis) 47/1049(alt screen)        │   ║
  ║  │    │     m(SGR) H/f(CUP) A-D(CUU/D/F/B) G(CHA) d(VPA)         │   ║
  ║  │    │     r(DECSTBM) J(ED 0/1/2/3) K(EL 0/1/2) — rest ignored   │   ║
  ║  │    └── state=osc     → accumulate until BEL — ignored           │   ║
  ║  │                                                                  │   ║
  ║  │  render(buf, inner: Rect)                                        │   ║
  ║  │    └── for each cell → buf.write(inner.row+r, inner.col+c, ...) │   ║
  ║  └──────────────────────────────────────────────────────────────────┘   ║
  ║                          │                                                ║
  ║                          ▼                                                ║
  ║             CellBuffer.diff(prev) ──► process.stdout                     ║
  ╚══════════════════════════════════════════════════════════════════════════╝

───────────────────────────────────────────────────────────────────────────────
## 3. PROJECT STRUCTURE — BEFORE vs AFTER
───────────────────────────────────────────────────────────────────────────────

  BEFORE (Wave 3.5)                      AFTER (Wave 4)
  ─────────────────────────────────      ────────────────────────────────────
  src/tui/
  ├── input/                             ├── input/
  │   ├── keyboard.ts                    │   ├── keyboard.ts
  │   ├── mouse.ts                       │   ├── mouse.ts
  │   └── router.ts                      │   ├── router.ts
  │                                      │   ├── vt.ts           ← NEW (431 ln)
  │                                      │   └── vt.test.ts      ← NEW (27 tests)
  ├── panels/                            ├── panels/
  │   ├── Panel.ts                       │   ├── Panel.ts
  │   ├── StatusBar.ts                   │   ├── StatusBar.ts
  │   ├── SessionPanel.ts                │   ├── SessionPanel.ts
  │   ├── OrchestrationCanvas.ts         │   ├── OrchestrationCanvas.ts
  │   └── AgentsPanel.ts                 │   ├── AgentsPanel.ts
  │                                      │   ├── TerminalPanel.ts   ← NEW (99 ln)
  │                                      │   └── TerminalPanel.test.ts ← NEW (7t)
  └── renderer/                          └── renderer/
      ├── ansi.ts                             ├── ansi.ts
      ├── cell-buffer.ts                      ├── cell-buffer.ts
      ├── layout.ts       ← MODIFIED          ├── layout.ts  +terminal Rect
      └── theme.ts                            └── theme.ts

  src/app.ts              ← MODIFIED     +tab, +mouse nav, +raw bypass, +resize

  Counts (diff from Wave 3.5 → Wave 4):
    Added files  :  4  (vt.ts, vt.test.ts, TerminalPanel.ts, TerminalPanel.test.ts)
    Modified     :  2  (layout.ts, app.ts)
    Net new lines:  ~640 production / ~350 test

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

  `terminal` occupies exactly the same columns as `canvas`+`agents` combined
  (same col, same width, same row start, full mainHeight). The render branch
  decides which view to draw:

    activeTab ∈ {0,1,2}  →  draw canvas + agents  (right column, split)
    activeTab = 3         →  draw terminal panel   (right column, full height)

  Session and StatusBar are unaffected — they render on every frame regardless
  of which tab is active.

───────────────────────────────────────────────────────────────────────────────
## 5. INPUT ROUTING — BEFORE vs AFTER
───────────────────────────────────────────────────────────────────────────────

  BEFORE (tabs 0–2, keyboard-only):
  ──────────────────────────────────
  stdin data
    → parseMouse()?  yes → router.dispatch(mouse, panels, activeTab)
    → parseKey()?    yes → hotkeys (Ctrl+Q, Tab, F1–F3, Ctrl+R)
                         → router.dispatch(key, panels, activeTab)

  AFTER — non-terminal tabs (0–2), now with mouse navigation:
  ─────────────────────────────────────────────────────────────
  stdin data
    → parseMouse()? yes
        left-press, row=0          → tabAt(col) → if ≥0 switch tab, return
        left-press, row>0          → panelTabAt(row,col) → if ≠ activeTab, update
        always                     → router.dispatch(mouse, panels, activeTab)
                                     if !consumed → render()
    → parseKey()? yes
        (unchanged from before)

  AFTER — terminal tab (3), raw-byte bypass + tab-bar mouse:
  ───────────────────────────────────────────────────────────
  stdin data
    data[0] = 0x11                 → App.stop()
    '\x1bOP' | '\x1b[11~'         → activeTab=0; render()       F1
    '\x1bOQ' | '\x1b[12~'         → activeTab=1; render()       F2
    '\x1bOR' | '\x1b[13~'         → activeTab=2; render()       F3
    '\x1bOS' | '\x1b[14~'         → no-op                        F4
    starts with '\x1b[<'           → parse SGR mouse:
        left-press row=0           → tabAt(col) → if ≥0 switch, render
        else                       → discard (do NOT forward to PTY)
    all other bytes                → TerminalPanel.write(data)

  Key design decisions preserved:
    • Tab key (0x09) forwarded to PTY — shells need it for completion.
    • Ctrl+R not intercepted in terminal mode — forwarded to PTY.
    • SGR mouse bytes are never forwarded to PTY (PTY has no mouse tracking).

  tabAt(col): number
  ──────────────────
    Walks TABS = ['Session','Orchestration','Agents','Terminal'], computing
    label = ' ${name} ' for each. Returns first i where col falls inside
    [startCol, startCol + label.length). Returns -1 if between tabs.

    Example (typical 80-col terminal):
      col  1–9   → 0 (Session)
      col 11–25  → 1 (Orchestration)
      col 27–34  → 2 (Agents)
      col 36–45  → 3 (Terminal)
      col 10,26,35 → -1 (gap between tabs)

  panelTabAt(row, col): number
  ────────────────────────────
    Checks layout rects in order:
      session.rect contains (row,col) → 0
      activeTab=3 AND terminal rect contains (row,col) → TAB_TERMINAL
      canvas rect contains (row,col) → 1
      agents rect contains (row,col) → 2
      else → -1

    If the returned tab ≠ activeTab, activeTab is updated before dispatch.
    This lets a single left-click both focus a panel and send the click to it.

───────────────────────────────────────────────────────────────────────────────
## 6. VTScreen ANSI SUPPORT MATRIX
───────────────────────────────────────────────────────────────────────────────

  ┌─────────────────────────────────────────────────────────────────────────┐
  │  SUPPORTED                                                              │
  ├───────────┬─────────────────────────────────────────────────────────────┤
  │  Text     │  All printable ASCII; soft-wrap at col boundary             │
  │  CR       │  \r — cursor column → 0                                     │
  │  LF       │  \n — cursor row++; scrollUp() if at scrollBottom           │
  │  BS       │  \x08 — cursor column--                                     │
  │  BEL      │  \x07 — ignored                                             │
  │  CUP      │  CSI H / f — set cursor row,col (1-based → 0-based)        │
  │  CUU      │  CSI A — cursor up N rows                                   │
  │  CUD      │  CSI B — cursor down N rows                                 │
  │  CUF      │  CSI C — cursor forward N cols                              │
  │  CUB      │  CSI D — cursor back N cols                                 │
  │  CHA      │  CSI G — cursor to column N (1-based)                       │
  │  VPA      │  CSI d — cursor to row N (1-based)                          │
  │  DECSTBM  │  CSI r — set scroll region top/bottom; cursor → home       │
  │  ED 0     │  CSI 0J — erase from cursor to display end                  │
  │  ED 1     │  CSI 1J — erase from display start to cursor                │
  │  ED 2/3   │  CSI 2J / 3J — erase entire display                        │
  │  EL 0     │  CSI 0K — erase from cursor to line end                     │
  │  EL 1     │  CSI 1K — erase from line start to cursor                   │
  │  EL 2     │  CSI 2K — erase entire line                                 │
  │  SGR 0    │  Reset all attributes                                        │
  │  SGR 1/2  │  Bold / dim                                                  │
  │  SGR 4    │  Underline                                                    │
  │  SGR 7/27 │  Reverse video on/off                                        │
  │  SGR 22   │  Bold+dim off                                                │
  │  SGR 24   │  Underline off                                               │
  │  SGR 30–37│  Standard 8-colour foreground                               │
  │  SGR 40–47│  Standard 8-colour background                               │
  │  SGR 90–97│  Bright 8-colour foreground                                  │
  │  SGR 100–107 Bright 8-colour background                                 │
  │  SGR 38;5;N  256-colour foreground                                       │
  │  SGR 48;5;N  256-colour background                                       │
  │  SGR 38;2;R;G;B  Truecolour fg (approximated to xterm-256)             │
  │  SGR 48;2;R;G;B  Truecolour bg (approximated to xterm-256)             │
  │  SGR 39/49│  Reset fg / bg to default                                   │
  │  OSC      │  Ignored (title sequences, Hyperlinks)                      │
  │  CSI ?25h │  Show cursor (cursorVisible=true)                           │
  │  CSI ?25l │  Hide cursor (cursorVisible=false)                          │
  │  CSI ?1049h  Enter alternate screen (save cursor, blank grid)           │
  │  CSI ?1049l  Exit alternate screen (restore primary + cursor)           │
  │  CSI ?47h │  Enter alternate screen (no cursor save)                    │
  │  CSI ?47l │  Exit alternate screen (no cursor restore)                  │
  ├───────────┴─────────────────────────────────────────────────────────────┤
  │  NOT SUPPORTED (silently ignored)                                        │
  ├─────────────────────────────────────────────────────────────────────────┤
  │  Wide characters (CJK, emoji) — rendered as single-width cells          │
  │  Insert/delete line (CSI L / M)                                          │
  │  Insert/delete char (CSI @ / P)                                          │
  │  Repeat char (CSI b)                                                     │
  │  Mouse tracking enable/disable from PTY side (CSI ?1000h etc.)          │
  │  Bracketed paste mode (CSI ?2004h/l)                                     │
  │  Cursor shape (CSI 1–6 SP q)                                             │
  │  Scrollback buffer                                                       │
  └─────────────────────────────────────────────────────────────────────────┘

───────────────────────────────────────────────────────────────────────────────
## 7. WORKFLOW WALK-THROUGHS
───────────────────────────────────────────────────────────────────────────────

### 7.1  Happy path — keyboard open terminal, run a command

  factory launches → initPanels() → TerminalPanel created when F4 pressed
     │
     ├── ensureTerminalPanel():
     │     pty.spawn(SHELL, [], { cols:58, rows:22, xterm-256color })
     │     pty.onData  → VTScreen.feed + scheduleRender
     │     pty.onExit  → alive=false + scheduleRender
     └── render(): "Terminal" tab highlighted, panel shows bash prompt

  User types "ls -la" + Enter
     │
     ├── raw bytes → TerminalPanel.write(data)
     ├── pty.onData echoes "ls -la\r\n" → VTScreen.feed → scheduleRender
     └── directory listing streams back:
           each chunk → VTScreen.feed → scheduleRender (coalesced)
           render() paints result into cell-buffer diff → stdout

  User presses F1 to return to Session
     │
     ├── raw '\x1bOP' detected → activeTab=0
     └── render(): Session + Orchestration + Agents drawn (terminal hidden)
           PTY still running; no kill

### 7.2  Happy path — mouse click to switch panels

  User is on the Session tab (activeTab=0)
     │
  User clicks "Orchestration" label in the tab bar (row=0, col~=11)
     │
     ├── parseMouse() → { button:'left', action:'press', row:0, col:11 }
     ├── mouse.row = 0 → tabAt(11) → 1
     ├── activeTab = 1
     └── render(): Orchestration canvas highlighted, canvas border active

  User clicks inside the Agents panel body (row~=18, col~=45)
     │
     ├── parseMouse() → { button:'left', action:'press', row:18, col:45 }
     ├── mouse.row > 0 → panelTabAt(18, 45) → 2
     ├── activeTab = 2
     └── render(): Agents border becomes active-colour
           router.dispatch(mouse) → AgentsPanel.onMouse() called

  User clicks "Terminal" tab in the bar
     │
     ├── tabAt(col) → 3
     ├── activeTab = 3
     └── ensureTerminalPanel() (lazy, idempotent) → render terminal

### 7.3  Mouse click from within Terminal tab

  User is on Terminal tab (activeTab=3)
     │
  User clicks "Session" tab label (row=0, col~=1)
     │
     ├── raw bytes = '\x1b[<0;1;0M' (SGR left-press)
     ├── starts with '\x1b[<' → parse SGR mouse
     ├── mouse.button='left', action='press', row=0 → tabAt(1) → 0
     ├── activeTab = 0
     └── render(): Session + Orchestration + Agents; PTY alive, not killed

  PTY mouse tracking sequences (e.g. '\x1b[<35;12;3M' from vim) are suppressed:
     ├── starts with '\x1b[<' → parse → not left-press row=0 → discard
     └── vim does not receive any mouse echo feedback (correct behaviour)

### 7.4  Alternate screen programs (vim, htop, less)

  User opens vim in terminal panel
     │
     ├── vim sends CSI ?1049h
     ├── VTScreen.enterAltScreen(saveCursor=true):
     │     altGrid = grid (save primary)
     │     altCurRow/Col/Style = current cursor state
     │     grid = makeGrid(rows, cols)  (blank new screen)
     │     curRow=0, curCol=0
     └── vim renders its UI into the fresh blank grid

  User presses :q! in vim
     │
     ├── vim sends CSI ?1049l
     ├── VTScreen.exitAltScreen(restoreCursor=true):
     │     grid = altGrid (restore primary)
     │     altGrid = null
     │     curRow/Col/Style = saved values
     └── shell prompt restored at saved cursor position

  Entering alt-screen twice (e.g. nested vim) is idempotent:
     ├── enterAltScreen: if (this.altGrid) return  ← no double-swap
     └── primary screen remains correctly saved

### 7.5  Scroll region programs (less, man)

  User opens `man ls` in terminal panel
     │
     ├── man sends CSI 1;23r  (DECSTBM: scroll rows 1–23, 1-based)
     ├── VTScreen: scrollTop=0, scrollBottom=22; cursor → (0,0)
     │
  User presses Space to page down
     │
     ├── man sends CUP sequences + text for new page
     ├── At bottom of region (curRow = scrollBottom = 22):
     │     LF → scrollUp() → splice:
     │       grid.splice(scrollTop=0, 1)   // remove top row of region
     │       grid.splice(scrollBottom=22, 0, blankRow)  // add row at bottom
     │     ← only rows 0–22 scroll; rows 23+ (status bar) untouched
     └── man's pager status line stays in place at row 23

### 7.6  Terminal resize

  User drags terminal window to new size
     │
     ├── process.stdout fires 'resize'
     ├── rows/cols updated; new CellBuffer pair allocated
     ├── computeLayout() recalculates all rects
     ├── terminalPanel.rect = layout.terminal  (if alive)
     ├── inner = { height: mainHeight-2, width: rightWidth-2 }
     ├── terminalPanel.resize(inner.height, inner.width)
     │     screen.resize(r, c)  — grid expanded/shrunk, cells preserved
     │     pty.resize(c, r)     — SIGWINCH sent to shell (cols, rows order)
     └── render() — shell reflows (bash/zsh/ls redraw to new COLUMNS)

  scrollTop/scrollBottom are reset to 0/rows-1 on resize (xterm behaviour).

### 7.7  Shell exits inside terminal panel

  User types "exit" in the terminal
     │
     ├── pty.onExit fires → alive=false; scheduleRender()
     └── render(): TerminalPanel.render(buf):
           "[terminal exited — press F1–F3 to switch panel]" written in dim fg

  Subsequent write() calls are no-ops (alive=false guard).
  Subsequent destroy() is a no-op (alive=false guard).
  F1 → activeTab=0; Session panel; TerminalPanel left in dead state.

### 7.8  Ctrl+Q quits from any tab

  Tab 0–2:  parseKey() → ctrl+q → App.stop()
  Tab 3:    data[0] === 0x11 → App.stop()

  App.stop():
    1. if (this.running) → this.running = false
    2. terminalPanel?.destroy()  (pty.kill; idempotent if already dead)
    3. stdin.removeAllListeners('data')
    4. stdin.setRawMode(false)
    5. stdin.pause()
    6. stdout.write(disableMouse + showCursor + exitAltScreen, () => exit(0))
       ← exit only AFTER sequences are fully flushed (callback form)

  process.on('exit') fires as last-resort: disableMouse + showCursor +
  exitAltScreen — ensures cleanup even on uncaught exceptions.
  Does NOT fire on SIGKILL.

### 7.9  Rapid output flood (cat large file / find /)

  PTY emits many onData chunks in rapid succession:
     │
     ├── each chunk: VTScreen.feed(chunk)  [synchronous, ~1 µs/char]
     ├── scheduleRender() → renderPending flag prevents duplicate setImmediates
     │     only ONE setImmediate queued per event-loop tick
     └── render() fires once per tick regardless of chunk count
           UI stays responsive; Ctrl+Q intercepted between renders

### 7.10  PTY spawn failure (missing node-pty native addon)

  TerminalPanel constructor:
     ├── try { pty.spawn(...) } catch (err) {
     │     alive = false
     │     spawnError = err.message
     │   }
     └── render():
           "[PTY unavailable: <spawnError>]" written in dim fg
           No crash propagated to App

───────────────────────────────────────────────────────────────────────────────
## 8. END-TO-END TEST PLAN
───────────────────────────────────────────────────────────────────────────────

### Preconditions

  • Node.js ≥ 20 (node-pty native addon requires it)
  • `npm run build` passes with zero TypeScript errors
  • Terminal emulator: xterm-compatible, ≥ 80×24, SGR mouse enabled, UTF-8
  • SHELL env var set (or bash available at /bin/bash)
  • npm test → 155/155 green before manual testing

### T1 — Tab bar click navigation

  Steps:
    1. factory (lands on Session tab by default)
    2. Click "Orchestration" label in the tab bar

  Expected:
    • "Orchestration" tab highlighted (accent bg)
    • Canvas panel border turns active-colour
    • Session panel still visible on left

  Steps:
    3. Click "Agents" label

  Expected:
    • "Agents" tab highlighted; Agents panel border active

  Steps:
    4. Click "Terminal" label

  Expected:
    • "Terminal" highlighted; right column shows Terminal panel
    • Shell prompt visible

  Validation: each click changes only the active tab; no side effects on
  panels not clicked.

### T2 — Panel body click to focus

  Steps:
    1. factory (Session tab)
    2. Click inside the right column (Orchestration canvas area)

  Expected:
    • activeTab switches to 1 (Orchestration)
    • Canvas border active; click dispatched to OrchestrationCanvas.onMouse()

  Steps:
    3. Click inside the bottom-right area (Agents panel)

  Expected:
    • activeTab switches to 2 (Agents); Agents border active

  Steps:
    4. Click inside the left column (Session panel)

  Expected:
    • activeTab switches to 0 (Session); Session border active

### T3 — Tab bar click from Terminal tab

  Steps:
    1. factory → F4 (enter Terminal)
    2. Click "Session" tab label in the top bar

  Expected:
    • Switches to Session tab; Orchestration/Agents visible in right column
    • PTY not killed (still running when returning to Terminal)

  Steps:
    3. Click "Terminal" tab label

  Expected:
    • Terminal tab re-activates; same PTY session continues

### T4 — Keyboard in terminal (not stolen)

  Steps:
    1. factory → F4
    2. Type "ls /et" (no Enter)
    3. Press Tab

  Expected:
    • "ls /etc" auto-completed (Tab forwarded to PTY)
    • Still on Terminal tab (not panel-switched)

### T5 — Alternate screen (vim)

  Steps:
    1. factory → F4
    2. Type "vim /tmp/test.txt" + Enter

  Expected:
    • vim UI fills the terminal panel (alternate screen)
    • Factory UI chrome (tab bar, session, status bar) still correct
    • vim navigation (h/j/k/l) works

  Steps:
    3. Type ":q!" in vim

  Expected:
    • Shell prompt restored at previous cursor position
    • No artefacts from vim's alternate screen

### T6 — Scroll region (less / man)

  Steps:
    1. factory → F4
    2. Type "man ls" + Enter

  Expected:
    • man page renders in terminal panel
    • Status line "(END)" or "Manual page ls(1) line N" stays in fixed position
    • Pressing Space advances pages; status line does not scroll with content

### T7 — Ctrl+Q from Terminal tab

  Steps:
    1. factory → F4
    2. Type partial command, do NOT press Enter
    3. Press Ctrl+Q

  Expected:
    • App exits cleanly; outer shell prompt restored
    • No raw-mode artefacts; cursor visible; mouse tracking disabled

### T8 — ANSI colour rendering

  Steps:
    1. factory → F4
    2. Type "ls --color=always" (Linux) or "ls -G" (macOS) + Enter

  Expected:
    • Directories in blue/cyan; executables in green; symlinks in cyan
    • Colours match a standard xterm-256 terminal

### T9 — Rapid output

  Steps:
    1. factory → F4
    2. Type "find /usr -name '*.js' 2>/dev/null" + Enter

  Expected:
    • Many lines stream; app stays responsive
    • Ctrl+Q exits cleanly mid-stream

### T10 — Resize while in Terminal

  Steps:
    1. factory → F4
    2. Type "bash --norc" (gives plain prompt)
    3. Resize the outer terminal window

  Expected:
    • Terminal panel reflows immediately
    • Shell COLUMNS/LINES updated (verify: echo $COLUMNS)
    • No crash, no garbage characters

### T11 — Shell exit + recovery

  Steps:
    1. factory → F4
    2. Type "exit" + Enter

  Expected:
    • "[terminal exited — press F1–F3 to switch panel]" shown in dim
    • No crash; app still running

  Steps:
    3. Press F1

  Expected:
    • Session panel active normally

### Common failure indicators

  ┌──────────────────────────────────┬──────────────────────────────────────┐
  │  Symptom                         │  Likely cause                        │
  ├──────────────────────────────────┼──────────────────────────────────────┤
  │  Click does nothing              │  SGR mouse not enabled in terminal   │
  │                                  │  (factory enables it via A.enableMouse│
  │                                  │  but emulator may override)          │
  ├──────────────────────────────────┼──────────────────────────────────────┤
  │  Click in panel does not focus   │  panelTabAt() rect mismatch          │
  ├──────────────────────────────────┼──────────────────────────────────────┤
  │  Tab bar click from terminal     │  SGR bytes forwarded to PTY instead  │
  │  does not switch panel           │  of parsed (regression in bypass)    │
  ├──────────────────────────────────┼──────────────────────────────────────┤
  │  Blank terminal panel            │  SHELL not set; pty.spawn failed;    │
  │                                  │  spawnError banner should appear     │
  ├──────────────────────────────────┼──────────────────────────────────────┤
  │  Garbled characters              │  TERM not xterm-compatible; try      │
  │                                  │  TERM=xterm-256color factory         │
  ├──────────────────────────────────┼──────────────────────────────────────┤
  │  Tab key switches panel          │  0x09 not forwarded in raw bypass    │
  ├──────────────────────────────────┼──────────────────────────────────────┤
  │  vim exits but artefacts remain  │  Alt-screen exit (CSI ?1049l) not    │
  │                                  │  handled by VTScreen                 │
  ├──────────────────────────────────┼──────────────────────────────────────┤
  │  man page status line scrolls    │  DECSTBM scroll region not respected  │
  ├──────────────────────────────────┼──────────────────────────────────────┤
  │  Raw mode stuck after Ctrl+Q     │  App.stop() not reached (uncaught    │
  │                                  │  exception); process.on('exit')      │
  │                                  │  should still clean up              │
  └──────────────────────────────────┴──────────────────────────────────────┘

### Automated tests (run before every push)

  node .../vitest run --root /path/to/wave-4-terminal

  Test files and what they cover:
    vt.test.ts            (27 tests) — VTScreen: text, cursor, erase, SGR,
                                        alt-screen, scroll region, resize, OSC
    TerminalPanel.test.ts  (7 tests) — spawn dims, onData/onExit lifecycle,
                                        resize, destroy idempotency, write, exit msg
    All others           (121 tests) — pre-existing regression suite

  Expected: 155/155 pass, 0 failures, 0 skipped.

───────────────────────────────────────────────────────────────────────────────
## 9. DESIGN REASONING & TRADE-OFFS
───────────────────────────────────────────────────────────────────────────────

  ┌────────────────────────────────┬─────────────────────────────────────────┐
  │  Decision                      │  Rationale / Trade-off                  │
  ├────────────────────────────────┼─────────────────────────────────────────┤
  │  VTScreen — hand-rolled ANSI   │  No DOM dependency; direct integration  │
  │  parser instead of xterm.js /  │  with CellBuffer. Trade-off: may miss   │
  │  node-ansiterminal             │  obscure sequences (ICH, DCH, REP…).    │
  ├────────────────────────────────┼─────────────────────────────────────────┤
  │  terminal rect = full right    │  Avoids a 5th layout slot. Terminal and  │
  │  column (overlays canvas+      │  canvas/agents cannot coexist in the     │
  │  agents, conditional render)   │  same area. Trade-off: no split-view.   │
  ├────────────────────────────────┼─────────────────────────────────────────┤
  │  Raw-byte bypass for PTY       │  parseKey() strips/drops sequences       │
  │  input when activeTab=3        │  shells need (readline, vi, tmux keymaps,│
  │                                │  OSC responses). Trade-off: Ctrl+R not  │
  │                                │  interceptable in terminal mode.        │
  ├────────────────────────────────┼─────────────────────────────────────────┤
  │  F-key: both xterm (\x1bOP)    │  Single-pattern match would break        │
  │  and VT100 (\x1b[11~) forms    │  PuTTY, Windows Terminal, GNOME Terminal │
  │  accepted                      │  in VT100 mode. Both are standard.      │
  ├────────────────────────────────┼─────────────────────────────────────────┤
  │  Tab bar + panel body mouse    │  Zero new infrastructure — reuses        │
  │  handled in App (not Router)   │  existing parseMouse(); tab bar is not   │
  │                                │  a Panel and cannot use Router. Trade-   │
  │                                │  off: App.listenInput() grows in size.  │
  ├────────────────────────────────┼─────────────────────────────────────────┤
  │  SGR mouse inspected (not      │  Before: blind discard. Now: tab-bar     │
  │  blindly suppressed) in        │  clicks work from Terminal mode too.     │
  │  Terminal tab path             │  PTY still never sees mouse bytes.      │
  ├────────────────────────────────┼─────────────────────────────────────────┤
  │  Alternate screen: dual-grid   │  Matches xterm spec exactly. altGrid    │
  │  swap in VTScreen              │  field holds primary grid while in alt   │
  │                                │  mode. enterAltScreen idempotent.       │
  ├────────────────────────────────┼─────────────────────────────────────────┤
  │  Scroll region: splice-based   │  grid.splice(scrollTop,1) + splice      │
  │  scrollUp()                    │  (scrollBottom,0,blank) — only the      │
  │                                │  bounded region shifts. O(rows) but     │
  │                                │  acceptable at TUI scale.               │
  ├────────────────────────────────┼─────────────────────────────────────────┤
  │  Lazy PTY spawn                │  TerminalPanel created on first F4/     │
  │  (ensureTerminalPanel)         │  click only. No shell process running   │
  │                                │  unless user switches to Terminal tab.  │
  ├────────────────────────────────┼─────────────────────────────────────────┤
  │  Truecolour RGB → 256 approx   │  CellBuffer fg/bg fields are number |  │
  │                                │  undefined. 24-bit RGB needs API change │
  │                                │  to store. Approximation is acceptable  │
  │                                │  for most prompts; Starship/P10k may   │
  │                                │  show slight shade differences.        │
  ├────────────────────────────────┼─────────────────────────────────────────┤
  │  scheduleRender coalescing     │  setImmediate + renderPending flag      │
  │  (setImmediate pattern)        │  prevents frame flood on cat/find.      │
  │                                │  Same pattern as SessionPanel. One      │
  │                                │  event-loop tick latency is imperceptible│
  └────────────────────────────────┴─────────────────────────────────────────┘

### Assumptions

  • Shell is xterm-compatible (TERM=xterm-256color set at spawn time).
  • PTY output is UTF-8; multi-byte characters occupy one cell (no wide-char
    handling — CJK, emoji may render as single-width, causing column offset).
  • F-key sequences match xterm application mode (\x1bOP–\x1bOS) or VT100
    mode (\x1b[11~–\x1b[14~). Unusual emulators (old PuTTY) may differ.
  • The physical terminal running factory supports SGR mouse for all panels.
    The PTY inside the Terminal panel does NOT re-enable mouse tracking.
  • node-pty is compiled for the host Node version (native addon).
  • One shell session is sufficient per factory instance (no split panes).

───────────────────────────────────────────────────────────────────────────────
## 10. IDENTIFIED GAPS & RISKS (POST-MITIGATION STATE)
───────────────────────────────────────────────────────────────────────────────

  Resolved gaps (fixed in this wave):
    ✓ VT-GAP-02  Alternate screen — implemented (dual-grid swap)
    ✓ VT-GAP-03  Scroll regions (DECSTBM) — implemented (splice-based)
    ✓ VT-GAP-04  VT100 F-key fallback — implemented (\x1b[11~–\x1b[14~)
    ✓ VT-GAP-05  SGR mouse suppression from PTY — implemented (inspect first)
    ✓ VT-GAP-08  Lazy PTY spawn — implemented (ensureTerminalPanel)
    ✓ VT-GAP-09  Graceful PTY unavailable — implemented (try/catch + banner)
    ✓ cursor vis  CSI ?25h/l — implemented (isCursorVisible flag)

  Open gaps:

  MEDIUM — VT-GAP-01
  ─────────────────────────────────────────────────────────────────────────────
    Wide characters (CJK, emoji) are written as a single cell but occupy two
    columns in the physical terminal. This causes a one-column render offset
    for the rest of the affected line.
    Risk: low in most western shells; high in CJK environments.
    Fix: after writing a wide char, write a blank placeholder at col+1 and
    advance curCol by 2. Requires a unicode-width lookup (wcwidth).

  MEDIUM — VT-GAP-06
  ─────────────────────────────────────────────────────────────────────────────
    No scrollback buffer. Output that scrolls past the top of VTScreen is
    permanently discarded. Users cannot scroll back to review past output.
    Risk: inconvenient for long-running commands.
    Fix: maintain a ring buffer of N extra rows; Shift+PgUp/PgDn to scroll.

  LOW — VT-GAP-07
  ─────────────────────────────────────────────────────────────────────────────
    Truecolour (24-bit RGB) SGR is approximated to xterm-256 palette.
    Prompts using Starship or Powerlevel10k may show slightly wrong colours.
    Risk: cosmetic only; no functional impact.
    Fix: change CellBuffer.fg/bg to number | [r,g,b] | undefined; emit
    CSI 38;2;R;G;B when writing truecolour cells.

  LOW — INFRA-W4-01
  ─────────────────────────────────────────────────────────────────────────────
    node-pty requires native compilation (node-gyp). On Docker or bare CI
    machines, needs python3 + make + g++.
    Fix: document in a Dockerfile — RUN apt-get install -y python3 make g++

  LOW — INFRA-W4-02
  ─────────────────────────────────────────────────────────────────────────────
    npm publish will include node-pty as a hard dependency. Binary addons
    are platform-specific; end users need compilation tools or prebuilt bins.
    Fix: consider optionalDependencies + graceful PTY-unavailable path
    (already partially handled by VT-GAP-09 fix).

───────────────────────────────────────────────────────────────────────────────
## 11. POTENTIAL ENHANCEMENTS
───────────────────────────────────────────────────────────────────────────────

  SHORT-TERM (before Wave 5 ships)
  ──────────────────────────────────
  • VT-GAP-01: Wide-character double-cell rendering (wcwidth table)
  • VT-GAP-07: Native truecolour support in CellBuffer
  • Shell indicator in StatusBar: show cwd / git branch from PTY OSC 7
  • Mouse forwarding to PTY: click-to-position cursor in vim/nano

  LONG-TERM (Wave 5+)
  ───────────────────
  • VT-GAP-06: Scrollback buffer (ring buffer, Shift+PgUp/PgDn)
  • Multiple PTY panes (horizontal/vertical split with dynamic layout)
  • Clipboard integration: copy selection from terminal panel to system clipboard
  • Session persistence: reconnect to a detached PTY on restart (via tmux/dtach)
  • Bracketed paste: honour PTY bracketed paste mode for safe multi-line pastes

───────────────────────────────────────────────────────────────────────────────
## 12. DOCUMENTATION TRACKING AUDIT
───────────────────────────────────────────────────────────────────────────────

  ┌──────────────────────────────────────────────────┬──────────┬───────────┐
  │  Document                                        │  Status  │  Notes    │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  docs/features/FEATURE-WAVE-4-TERMINAL-PANEL-2026-05-18.md  │  ✓ v1.1  │  this doc │
  │  (this file)                                     │          │  updated  │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  specs/docs/approvedPlans/                       │  ✓ cur   │  plan doc │
  │    2026-05-18-wave-4-terminal-panel.md           │          │  on main  │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  docs/features/FEATURE-SYSTEM-ARCHITECTURE-      │  PENDING │  add W4   │
  │    v0.4.0.md                                     │          │  section  │
  │                                                  │          │  post-    │
  │                                                  │          │  merge    │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  .ai/project-index.yml                           │  ✓ cur   │  v1.5.0   │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  .ai/memory/milestones.md                        │  PENDING │  W4 row   │
  │                                                  │          │  → ✓ done │
  │                                                  │          │  on merge │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  README.md                                       │  PENDING │  wave     │
  │                                                  │          │  table:   │
  │                                                  │          │  W4 →     │
  │                                                  │          │  ✓ done   │
  │                                                  │          │  on merge │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  docs/REVIEW-SECURITY-ARCHITECTURE-*.md          │  PENDING │  PTY +    │
  │                                                  │          │  mouse    │
  │                                                  │          │  surface  │
  │                                                  │          │  needs    │
  │                                                  │          │  review   │
  └──────────────────────────────────────────────────┴──────────┴───────────┘

  Post-merge checklist:
    □ .ai/memory/milestones.md: W4 row → ✓ done, branch feature/wave-4-terminal
    □ README.md: wave table W4 "planned" → "✓ done"
    □ FEATURE-SYSTEM-ARCHITECTURE-v0.4.0.md:
        - Add TerminalPanel to component map
        - Add 4th tab + mouse navigation to workflow walk-throughs
        - Add VT-GAP-01/06/07 to gap inventory (others resolved)
    □ Security review: schedule update covering TerminalPanel PTY attack
        surface, mouse injection risks, raw-byte pass-through

  Review enforcement:
    • This doc updated alongside the feature code in the same branch (PR #15).
    • project-index.yml updated in same commit (Rule 8).
    • Version marker present (<!-- version: 1.1.0 -->).
    • Approved plan in specs/docs/approvedPlans/ (Rule 1).

───────────────────────────────────────────────────────────────────────────────
## 13. INFRASTRUCTURE CONFIGURATION AUDIT
───────────────────────────────────────────────────────────────────────────────

  ╔══════════════════════════════════════════════════════════════════╗
  ║  Docker Compose   NOT PRESENT — no change needed for Wave 4      ║
  ║  Ansible          NOT PRESENT — no change needed for Wave 4      ║
  ║  CI/CD            NOT PRESENT — INFRA-01 gap still open          ║
  ╚══════════════════════════════════════════════════════════════════╝

  Wave 4 adds a native addon (node-pty) with compile-time implications:

  INFRA-W4-01  node-pty requires native compilation (node-gyp).
               On bare machines: needs python3, make, g++.
               On Docker (future): use node image with build-essential:
                 RUN apt-get install -y python3 make g++ && npm ci
               On CI (future, INFRA-01): GitHub Actions ubuntu-latest has
               build tools; TerminalPanel tests use vi.mock so no real TTY
               needed in headless CI.

  INFRA-W4-02  If factory is published to npm, node-pty is a hard dependency.
               Binary addons are platform-specific.
               Mitigation: optionalDependencies + spawnError banner (done).

  INFRA-W4-03  CI test runner needs `--root` flag to resolve vitest from the
               correct working directory:
                 node .bin/vitest run --root /path/to/repo

  Drift between code and infra:
    • No Dockerfile or Compose file exists yet — no drift possible.
    • When INFRA-01 is addressed (CI pipeline), the pipeline MUST install
      build tools before `npm ci` to compile node-pty successfully.

  Validation steps:
    1. npm ci && npm run build — confirms native addon compiles
    2. node .bin/vitest run --root . — confirms 155/155 green
    3. npm run dev — confirms PTY spawns and terminal panel works

  PR checklist items:
    □ Does `npm ci` succeed on a fresh clone? (confirms node-pty compiles)
    □ Does `npm test` report 155/155 green?
    □ Does `npx tsc --noEmit` report 0 errors?
    □ Does the terminal tab render a shell prompt after F4?
    □ Does vim open/close without screen artefacts?
    □ Does clicking tabs switch the active panel?
