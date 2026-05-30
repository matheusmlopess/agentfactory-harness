<!-- version: 1.1.0 -->
# agentfactory-harness — System Architecture & Operational Reference
# (Waves 0 – 4, v0.4.0)

╔══════════════════════════════════════════════════════════════════════════════╗
║  SCOPE  Waves 0–3.5 (all implemented code as of 2026-05-18)                 ║
║  STATUS Wave 4 plan approved, not yet implemented                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

───────────────────────────────────────────────────────────────────────────────
## 1. WHAT THE SYSTEM IS
───────────────────────────────────────────────────────────────────────────────

`factory` is a full-screen TypeScript TUI (Terminal User Interface) that acts as
an interactive orchestration shell for AI agents. It introduces the ITUI concept:
mouse drag-and-drop ASCII canvas for building agent DAGs, a streaming Claude/OpenAI
session panel, a live execution canvas, and (Wave 4) an embedded real terminal —
all rendered via a custom raw ANSI cell-buffer renderer with no framework dependency.

Three execution planes:

  ┌─────────────────────────────────────────────────────────────────────────┐
  │  AGENT PLANE       │  Claude/OpenAI streaming loop, tools, hooks        │
  │  ORCHESTRATION     │  ITUI canvas, af-plan.json DAG executor            │
  │  REGISTRY (wave 5) │  agentfactory.dev import/publish, auth token       │
  └─────────────────────────────────────────────────────────────────────────┘

───────────────────────────────────────────────────────────────────────────────
## 2. PROJECT STRUCTURE (current, v0.4.0)
───────────────────────────────────────────────────────────────────────────────

Before/after view — each wave added a layer; nothing was removed.

  BEFORE (v0.1.0 — Wave 0 only)         AFTER (v0.4.0 — Waves 0–3.5)
  ─────────────────────────────────      ──────────────────────────────────────
  src/                                   src/
  ├── index.ts                           ├── index.ts
  ├── cli.ts                             ├── cli.ts              [extended W3]
  ├── app.ts                             ├── app.ts              [extended W1-3]
  ├── harness/                           ├── harness/
  │   └── doctor.ts                      │   └── doctor.ts       [updated W3.5]
  ├── tui/                               ├── tui/
  │   ├── renderer/                      │   ├── renderer/
  │   │   ├── ansi.ts                    │   │   ├── ansi.ts
  │   │   ├── cell-buffer.ts             │   │   ├── cell-buffer.ts
  │   │   ├── layout.ts                  │   │   ├── layout.ts
  │   │   └── theme.ts                   │   │   └── theme.ts
  │   ├── input/                         │   ├── input/
  │   │   └── keyboard.ts               │   │   ├── keyboard.ts
  │   │                                  │   │   ├── mouse.ts    [new W2]
  │   │                                  │   │   └── router.ts   [new W2]
  │   └── panels/                        │   ├── panels/
  │       ├── Panel.ts                   │   │   ├── Panel.ts
  │       ├── StatusBar.ts               │   │   ├── StatusBar.ts
  │       └── SessionPanel.ts            │   │   ├── SessionPanel.ts [new W1]
  │                                      │   │   ├── OrchestrationCanvas.ts [W2]
  │                                      │   │   └── AgentsPanel.ts  [new W1]
  │                                      │   └── widgets/
  │                                      │       ├── Block.ts        [new W2]
  │                                      │       ├── Wire.ts         [new W2]
  │                                      │       └── ContextMenu.ts  [new W2]
  │                                      ├── core/
  │                                      │   ├── agent-loop.ts      [new W1]
  │                                      │   ├── session.ts         [new W1]
  │                                      │   ├── hooks.ts           [new W1]
  │                                      │   ├── llm/               [new W3.5]
  │                                      │   │   ├── types.ts
  │                                      │   │   ├── index.ts
  │                                      │   │   ├── anthropic-adapter.ts
  │                                      │   │   └── openai-adapter.ts
  │                                      │   └── tools/
  │                                      │       ├── index.ts       [new W1]
  │                                      │       ├── bash.ts        [new W1]
  │                                      │       ├── read.ts        [new W1]
  │                                      │       ├── write.ts       [new W1]
  │                                      │       ├── web-fetch.ts   [new W1]
  │                                      │       └── agent.ts       [new W3]
  │                                      └── orchestration/
  │                                          ├── schema.ts          [new W3]
  │                                          ├── executor.ts        [new W3]
  │                                          ├── planner.ts         [new W3]
  │                                          └── graph.ts           [new W3]

  Added components (W4 plan, not yet on disk):
    src/tui/input/vt.ts
    src/tui/panels/TerminalPanel.ts

───────────────────────────────────────────────────────────────────────────────
## 3. COMPONENT REFERENCE
───────────────────────────────────────────────────────────────────────────────

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  RENDERER LAYER  (src/tui/renderer/)                                     │
  │                                                                          │
  │  ansi.ts        Raw ESC/CSI sequence builders — moveTo, sgr, clear,     │
  │                 enterAltScreen, enableMouse. No parsing — output only.   │
  │                                                                          │
  │  cell-buffer.ts Cell[][] grid. write(row,col,text,style) paints cells.  │
  │                 diff(prev) produces minimal ANSI delta string.           │
  │                 flush() repaints everything. clone() snapshots.         │
  │                                                                          │
  │  layout.ts      computeLayout(rows,cols) → PanelLayout (five Rects):    │
  │                   tabBar(1 row) | session(40%) | canvas(60%×70%) |       │
  │                   agents(60%×30%) | statusBar(1 row)                    │
  │                 drawBorder(buf, rect, title, focused) — box-draw chars  │
  │                                                                          │
  │  theme.ts       256-colour palette (bg, bgPanel, border, accent …)      │
  │                 Box/DBox/Wire character sets for borders and wires       │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  INPUT LAYER  (src/tui/input/)                                           │
  │                                                                          │
  │  keyboard.ts    parseKey(Buffer) → KeyEvent | null                       │
  │                 Handles: printable chars, ctrl+X, arrow keys, F-keys,   │
  │                 special keys (Esc, Tab, Enter, Backspace, Delete)        │
  │                 Mouse bytes are silently ignored (returned null).        │
  │                                                                          │
  │  mouse.ts       parseMouse(Buffer) → MouseEvent | null                   │
  │                 Parses xterm SGR protocol: \033[<Pb;Px;PyM/m            │
  │                 Fields: button, col, row, press/release, drag           │
  │                                                                          │
  │  router.ts      dispatch(event, panels, focusedIndex)                    │
  │                 Routes KeyEvent/MouseEvent to the currently focused      │
  │                 panel. Mouse events hit-test all panels regardless of   │
  │                 focus. Returns boolean (consumed flag).                  │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  PANELS  (src/tui/panels/)                                               │
  │                                                                          │
  │  Panel.ts          Abstract base: rect, focused, inner(Rect),           │
  │                    render(buf), onKey(e), onMouse(e)                     │
  │                                                                          │
  │  SessionPanel.ts   Chat + agent loop. Maintains ChatLine[] scrollback.  │
  │                    Input bar at bottom row. /help, /plan new, /run,     │
  │                    /doctor slash commands. Streams Claude/OpenAI tokens  │
  │                    character-by-character into lines. Scroll: PgUp/Dn.  │
  │                                                                          │
  │  OrchestrationCanvas.ts  ITUI drag-drop surface. Renders Block widgets  │
  │                    at their (x,y) positions, draws Wire paths between   │
  │                    ports. Right-click opens ContextMenu. syncFromPlan() │
  │                    / applyStepEvent() bridge the canvas to the executor.│
  │                                                                          │
  │  AgentsPanel.ts    Sidebar list of agent names + status badges.          │
  │                    Status: idle · running · done · error.               │
  │                                                                          │
  │  StatusBar.ts      Bottom row: version label, mode text, keybind hints. │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  WIDGETS  (src/tui/widgets/)                                             │
  │                                                                          │
  │  Block.ts     Renders one agent node box. Title, version badge,         │
  │               status icon (○/⏳/✓/✗), input/output port chars.         │
  │                                                                          │
  │  Wire.ts      L-shaped path router. Given (fromPort, toPort) pixel      │
  │               coords, computes an elbow route avoiding collisions.      │
  │                                                                          │
  │  ContextMenu.ts  Right-click popup. Up/down arrow navigation, Enter     │
  │               to select, Esc to close. Positioned to avoid canvas edge. │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  CORE  (src/core/)                                                       │
  │                                                                          │
  │  session.ts    Conversation history array, token tracking, addMessage,  │
  │                getHistory, clear.                                        │
  │                                                                          │
  │  agent-loop.ts async* agentLoop(session, opts): AsyncIterable<AgentEvent>│
  │                Drives one or more turns of the LLM loop:                │
  │                  1. Build message array from Session history             │
  │                  2. Stream via adapter.stream()                          │
  │                  3. Emit text_delta events for UI streaming              │
  │                  4. On tool_use stop_reason: dispatch tool, inject result│
  │                  5. Loop until end_turn or maxTurns                      │
  │                Emits: text_delta | tool_start | tool_result | turn_end  │
  │                        | error                                           │
  │                                                                          │
  │  hooks.ts      runHook(event, ctx) — fires shell scripts from           │
  │                .ai/hooks/<EventName>/ if present.                        │
  │                Events: PreToolUse, PostToolUse, SessionStart,            │
  │                        SessionStop, StepStart, StepComplete, AgentSpawn  │
  │                                                                          │
  │  tools/        BashTool, ReadTool, WriteTool, WebFetchTool, AgentTool   │
  │                Registered via registerTool(). Dispatched by agentLoop   │
  │                when the model emits a tool_use block.                   │
  │                AgentTool spawns a child agentLoop and returns text.     │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  LLM ADAPTER LAYER  (src/core/llm/)  — Wave 3.5                         │
  │                                                                          │
  │  types.ts      LLMAdapter interface, StreamChunk, Provider union         │
  │                ('anthropic' | 'openai')                                  │
  │                                                                          │
  │  anthropic-adapter.ts  Wraps @anthropic-ai/sdk. Maps LLMStreamOptions   │
  │                        and ToolDef to Anthropic message params. Streams │
  │                        MessageStreamEvent → StreamChunk.                │
  │                                                                          │
  │  openai-adapter.ts     Wraps openai npm SDK. Same interface, maps to    │
  │                        ChatCompletion streaming. Tool schemas use        │
  │                        OpenAI function-calling format.                   │
  │                                                                          │
  │  index.ts      createAdapter(provider) factory. defaultProvider() reads │
  │                LLM_PROVIDER env var (defaults to 'anthropic').          │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  ORCHESTRATION  (src/orchestration/)  — Wave 3                           │
  │                                                                          │
  │  schema.ts     Zod PlanSchema / StepSchema for af-plan.json:            │
  │                  version, name, steps[]:                                 │
  │                    id (unique), agent, prompt, dependsOn[],             │
  │                    timeout?, provider?, model?                           │
  │                                                                          │
  │  graph.ts      toposort(steps) — Kahn's algorithm, throws on cycle.    │
  │                detectCycles(steps) — DFS, returns cycle arrays.         │
  │                readySet(steps, completed) — steps with all deps done.   │
  │                                                                          │
  │  executor.ts   Executor.run() — AsyncIterable<StepEvent>                │
  │                  • Topological sort at construction (fail-fast)          │
  │                  • Event queue for interleaved concurrent results        │
  │                  • Promise.race fan-out with maxConcurrency=3 semaphore  │
  │                  • {{id}} interpolation: earlier step outputs injected  │
  │                    into dependent step prompts at runtime                │
  │                  • Cascade-skip: transitive dependents of failed steps  │
  │                  Events: step:start | step:done | step:error |          │
  │                           step:skipped | plan:done                       │
  │                                                                          │
  │  planner.ts    Planner.wizard(cwd) — readline interactive prompt to     │
  │                create af-plan.json: name, N steps (id/agent/prompt/deps)│
  └──────────────────────────────────────────────────────────────────────────┘

───────────────────────────────────────────────────────────────────────────────
## 4. FULL WORKFLOW WALK-THROUGHS
───────────────────────────────────────────────────────────────────────────────

### 4.1  App start — happy path

  factory
     │
     ├─ src/index.ts ──── reads VERSION from package.json
     │                     if no CLI args → App.start()
     │                     if has args    → buildCli(version).parse()
     │
     └─ App.start()
           ├── setup()          alt-screen, hide cursor, enable SGR mouse,
           │                    register SIGINT/SIGTERM/exit handlers
           ├── initPanels()     computeLayout → create SessionPanel,
           │                    OrchestrationCanvas, AgentsPanel
           ├── tryLoadPlan()    read af-plan.json → PlanSchema.parse()
           │                    → canvasPanel.syncFromPlan()
           │                    (silent fail if no file or invalid)
           ├── render()         first full paint
           └── listenInput()    stdin raw mode, data listener

### 4.2  User types a message in Session panel

  Key 'a' arrives → stdin data → parseKey() → KeyEvent{key:'a'}
     │
     ├─ activeTab === 0 (Session focused)
     ├─ router.dispatch(key, panels, 0)
     ├─ SessionPanel.onKey({key:'a'}) → inputBuf += 'a', scheduleRender()
     └─ on Enter:
           ├── session.addMessage({role:'user', content: inputBuf})
           ├── inputBuf = ''
           ├── streaming = true; scheduleRender()
           └── for await event of agentLoop(session):
                 ├── text_delta → lines.last.text += delta; scheduleRender()
                 ├── tool_start → log "[tool] bash"
                 ├── tool_result → log result
                 └── turn_end → streaming = false; scheduleRender()

### 4.3  Slash command /plan new

  SessionPanel.onKey({key:'enter'}) where inputBuf === '/plan new'
     │
     └─ Planner.wizard(cwd)
           ├── readline: enter plan name
           ├── readline loop: enter step id / agent / prompt / deps
           ├── write af-plan.json to cwd
           └─ tryLoadPlan() auto-reload → syncFromPlan() paints canvas

### 4.4  factory run (CLI, no TUI)

  factory run [path]
     │
     ├── read + PlanSchema.parse()
     ├── Executor construction → toposort() (throws on cycle)
     └── for await event of executor.run():
           ├── step:start  → stderr: "step:start      fetch"
           ├── (concurrently runs up to 3 steps via agentRunner)
           ├── step:done   → stderr: "step:done       fetch"
           ├── step:error  → stderr: "step:error      fetch — <msg>"
           ├── step:skipped→ stderr: "step:skipped    summarise"
           └── plan:done   → stderr: "plan:done"

### 4.5  DAG execution with interpolation

  Plan:  fetch → transform({{fetch}}) → load({{transform}})
     │
     ├── readySet({fetch,transform,load}, completed={}) → {fetch}
     ├── runStep(fetch) → agentRunner() → "raw data"
     │     outputs.set('fetch', 'raw data')
     │     completed.add('fetch')
     ├── readySet → {transform}
     ├── runStep(transform) → prompt = "process {{fetch}}"
     │     → "process raw data" (after interpolate())
     │     outputs.set('transform', 'processed data')
     └── runStep(load) → prompt = "load {{transform}}"
           → "load processed data"

### 4.6  Cascade skip on failure

  Plan:  fetch → [transform, cache] → load(dependsOn:[transform,cache])
     │
     ├── fetch FAILS
     ├── transitiveDependents({fetch}) → {transform, cache, load}
     └── all three emit step:skipped immediately — agentRunner never called

### 4.7  Mouse drag on canvas (Tab 2)

  Click-drag on a Block:
     ├── parseMouse(data) → MouseEvent{button:0, col:X, row:Y, press:true}
     ├── router.dispatch(mouse, panels, 1) → canvas.onMouse(e)
     ├── canvas finds block at (X,Y) → dragState = {block, offsetX, offsetY}
     ├── subsequent drag events → block.x = col - offsetX, render()
     └── release → dragState = null

  Right-click on canvas:
     ├── MouseEvent{button:2, press:true}
     ├── canvas.onMouse → new ContextMenu at (row, col)
     │     ── clamps to canvas edge (fixes RangeError from PR #13)
     ├── Esc/Enter handled by canvas.onKey while menu is open
     └── Enter selects action, Esc closes

### 4.8  factory doctor

  factory doctor
     ├── runDoctor(cwd) → CheckResult[]
     │     ├── Node.js ≥ 20 ?
     │     ├── LLM_PROVIDER (env, default: anthropic)
     │     ├── ANTHROPIC_API_KEY set ?
     │     ├── OPENAI_API_KEY set ?
     │     ├── ~/.agentfactory/token exists ?
     │     └── .ai/ directory present ?
     └── printDoctorReport(results) → coloured pass/fail lines

───────────────────────────────────────────────────────────────────────────────
## 5. EDGE CASES AND FAILURE MODES
───────────────────────────────────────────────────────────────────────────────

  ┌──────────────────────┬──────────────────────────────────────────────────┐
  │  Scenario            │  System behaviour                                │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │  af-plan.json missing│  tryLoadPlan silently swallows error; canvas     │
  │                      │  stays empty; /plan new available in Session      │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │  Invalid af-plan.json│  Zod parse throws; caught in tryLoadPlan; same   │
  │                      │  silent-ignore behaviour. ZodError on factory run │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │  Cycle in plan       │  Executor constructor calls toposort() which     │
  │                      │  throws Error("cycle detected: a→b→a"). factory  │
  │                      │  run prints error and exits 1.                   │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │  agentRunner throws  │  Executor catches per-step; emits step:error,    │
  │                      │  adds to failed set, cascades skips downstream.  │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │  Terminal resize     │  process.stdout 'resize' handler recomputes      │
  │                      │  layout, replaces buffers, re-renders all panels.│
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │  Rapid left-clicks   │  OrchestrationCanvas debounces clicks (PR #13). │
  │                      │  Previously caused terminal crash via rapid re-  │
  │                      │  entrant renders.                                 │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │  Right-click at edge │  ContextMenu clamps position (PR #13 RangeError  │
  │                      │  fix). Popup stays within canvas bounds.         │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │  ANTHROPIC_API_KEY   │  agentLoop emits error AgentEvent; SessionPanel  │
  │  not set             │  prints error line in chat. App stays running.   │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │  Ctrl+C / SIGINT     │  App.stop() — drain stdin, restore mouse/cursor/ │
  │                      │  alt-screen, exit 0. No dangling raw mode.       │
  ├──────────────────────┼──────────────────────────────────────────────────┤
  │  Uncaught exception  │  process 'exit' hook always fires disableMouse   │
  │                      │  + showCursor + exitAltScreen before exit.       │
  └──────────────────────┴──────────────────────────────────────────────────┘

───────────────────────────────────────────────────────────────────────────────
## 6. END-TO-END TEST PLAN
───────────────────────────────────────────────────────────────────────────────

### Preconditions
  • Node.js ≥ 20 installed
  • ANTHROPIC_API_KEY set (or OPENAI_API_KEY if using openai provider)
  • Repo cloned, `npm install` run, `npm run build` succeeds
  • Terminal is ≥ 80×24 and supports xterm-256color + SGR mouse

### Test T1 — factory doctor

  Steps:
    1. Unset ANTHROPIC_API_KEY temporarily
    2. factory doctor

  Expected:
    ✓ Node.js version   → green
    ✓ LLM_PROVIDER      → green (shows 'anthropic')
    ✗ ANTHROPIC_API_KEY → red (not set)
    ✗ Registry token    → red (unless ~/.agentfactory/token exists)
    ✗/.ai/ directory    → red (unless run from the project root with .ai/)

  Validation: exit code 0 (doctor never exits non-zero); output printed to stdout.

### Test T2 — TUI launch and panel switching

  Steps:
    1. factory
    2. Press F1, F2, F3 to cycle panels
    3. Press Tab to cycle
    4. Press Ctrl+Q to exit

  Expected:
    • Alt-screen activated; 3 tabs visible; Session tab highlighted on start
    • F2 highlights Orchestration; F3 highlights Agents
    • Tab cycles Session→Orchestration→Agents→Session
    • Ctrl+Q exits cleanly; normal shell restored (no raw-mode artifact)

  Validation: shell prompt returns cleanly; no garbage characters in terminal.

### Test T3 — Session chat (requires API key)

  Steps:
    1. factory (Tab 1 active)
    2. Type "Hello" and press Enter
    3. Observe streaming response

  Expected:
    • Typed chars appear in input bar
    • On Enter: line moves to chat area with accent colour
    • "… " spinner appears in input bar during streaming
    • Assistant text streams token-by-token into chat
    • Streaming stops; cursor returns to input bar

### Test T4 — Plan wizard and canvas sync

  Steps:
    1. factory (Tab 2 active)
    2. Switch to Tab 1 (Session)
    3. Type "/plan new" and press Enter
    4. Enter: name=test-plan, 2 steps (fetch/summarise, summarise dependsOn fetch)
    5. Switch to Tab 2

  Expected:
    • Wizard prompts appear in Session panel via stdout
    • af-plan.json written to cwd
    • Canvas (Tab 2) shows two Block widgets connected by a Wire

### Test T5 — factory run (headless)

  Steps:
    1. Create af-plan.json with 2 steps (no dependsOn)
    2. factory run
    3. Observe stderr event stream

  Expected:
    step:start      step-a
    step:start      step-b        (both start concurrently)
    step:done       step-a
    step:done       step-b
    plan:done

### Test T6 — Cascade skip

  Steps:
    1. Create af-plan.json with steps: fetch → transform → load
    2. Set agentRunner to throw on fetch (use an invalid API key)
    3. factory run

  Expected:
    step:start      fetch
    step:error      fetch — <error>
    step:skipped    transform
    step:skipped    load
    plan:done

### Test T7 — plan validate

  Steps:
    1. factory plan validate af-plan.json (valid)
    2. Edit af-plan.json to add a cycle (a→b→a)
    3. factory plan validate af-plan.json

  Expected T7a: Plan "test-plan" is valid (2 steps)
  Expected T7b: exits 1, stderr "cycle detected: ..."

### Test T8 — Mouse drag on canvas

  Steps:
    1. factory (Tab 2)
    2. Create a plan with 1 block via /plan new
    3. Click-hold on the block and drag

  Expected:
    • Block follows cursor while held
    • Release places block at new position
    • Canvas re-renders immediately

### Test T9 — Right-click context menu at corner

  Steps:
    1. factory (Tab 2, canvas active)
    2. Right-click in the bottom-right corner of the canvas

  Expected:
    • ContextMenu appears fully inside the canvas bounds
    • No RangeError; no terminal crash

### Common failure indicators

  • Terminal left in raw mode after exit → restart terminal
  • Blank screen after launch → TERM missing or <80 cols
  • "ZodError" on factory run → malformed af-plan.json
  • "cycle detected" on factory run → circular dependsOn chain
  • No streaming response → ANTHROPIC_API_KEY not set or invalid

───────────────────────────────────────────────────────────────────────────────
## 7. DESIGN REASONING & TRADE-OFFS
───────────────────────────────────────────────────────────────────────────────

  ┌──────────────────────────────────────────────────────────────────────────┐
  │  Decision                  │  Why / Trade-off                           │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Raw ANSI renderer (no Ink │  Full control over cell layout, minimal    │
  │  / blessed)                │  deps. Trade-off: must implement everything │
  │                            │  (scroll, borders, input) manually.        │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  CellBuffer.diff()         │  Minimal-diff rendering prevents terminal  │
  │  (dirty-diffing, not full  │  flicker on fast updates. Trade-off: needs │
  │  repaint each frame)       │  clone() for previous state.               │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  scheduleRender via        │  Coalesces rapid events into a single frame │
  │  setImmediate              │  so mouse drags/streaming don't flood the  │
  │                            │  terminal. Trade-off: one-tick render lag.  │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  Executor: Promise.race    │  Simple concurrency without worker threads.│
  │  with maxConcurrency=3     │  Trade-off: no priority lanes; slow steps  │
  │                            │  block the fan-out slot count.             │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  {{id}} interpolation at   │  Simple regex replace; no templating engine│
  │  prompt level              │  dep. Trade-off: no escaping; malicious    │
  │                            │  step output can pollute downstream prompts│
  ├──────────────────────────────────────────────────────────────────────────┤
  │  LLM adapter layer (W3.5)  │  Provider-agnostic agent loop. Trade-off: │
  │  thin wrappers             │  no streaming back-pressure; entire chunk  │
  │                            │  from provider is emitted as-is.           │
  ├──────────────────────────────────────────────────────────────────────────┤
  │  tryLoadPlan silent fail   │  UX: users without a plan file don't see   │
  │                            │  an error on launch. Trade-off: silent      │
  │                            │  ignore of malformed plans is confusing.   │
  └──────────────────────────────────────────────────────────────────────────┘

### Assumptions

  • Single-user / single-process; no concurrent factory instances share state.
  • Terminal is xterm-compatible (SGR mouse, 256-colour, UTF-8).
  • LLM API credentials are in environment variables (not a config file).
  • af-plan.json is in the current working directory.
  • AgentTool's child agentLoop shares the same process; no sandboxing.

───────────────────────────────────────────────────────────────────────────────
## 8. IDENTIFIED GAPS & RISKS
───────────────────────────────────────────────────────────────────────────────

  CRITICAL (affect correctness / security)
  ─────────────────────────────────────────
  GAP-01  {{id}} interpolation has no output sanitisation. A step whose agent
          output contains "{{other-id}}" will corrupt downstream prompts.
          Fix (short-term): escape all occurrences of {{ in step outputs before
          storing in the outputs map.

  GAP-02  AgentTool spawns a child agentLoop with no resource limits (no token
          cap, no timeout enforced per sub-session beyond maxTurns=20). A
          recursive /spawn chain can exhaust API quota silently.
          Fix (short-term): pass an AbortSignal with a hard timeout into child
          agentLoop. Fix (long-term): per-agent token budget tracking.

  GAP-03  BashTool and WriteTool have no sandboxing. Any agent message can
          delete files or exfiltrate data. No confirmation step before
          destructive operations.
          Fix (short-term): PreToolUse hook gate (shell confirmation prompt).
          Fix (long-term): chroot/firejail sandbox around tool execution.

  HIGH (degrade reliability or usability)
  ─────────────────────────────────────────
  GAP-04  tryLoadPlan silently ignores malformed af-plan.json. The user gets no
          feedback that their plan file is invalid.
          Fix (short-term): surface Zod errors in the StatusBar or a modal line.

  GAP-05  Session history is in-memory only; cleared on App.stop(). Long
          conversations are lost on restart.
          Fix (short-term): persist session to ~/.agentfactory/sessions/<id>.json.

  GAP-06  CommandPalette (Ctrl+P fuzzy-search) is still marked "planned" from
          Wave 1. Discoverability of slash commands is low.
          Fix (short-term): implement CommandPalette (tracked separately).

  GAP-07  package.json version is 0.3.0 but Wave 3 and Wave 3.5 are merged;
          should be 0.4.0.
          Fix (immediate): bump version.

  MEDIUM (quality / maintainability)
  ────────────────────────────────────
  GAP-08  No scrollback buffer for OrchestrationCanvas. If the plan has more
          blocks than fit on screen, off-screen blocks are invisible.

  GAP-09  SessionPanel hardcodes "factory v0.2.0" in the welcome message
          (stale version string).

  GAP-10  No integration / smoke tests for the TUI lifecycle (App.start/stop,
          resize). All tests are unit tests for isolated modules.

───────────────────────────────────────────────────────────────────────────────
## 9. DOCUMENTATION TRACKING AUDIT
───────────────────────────────────────────────────────────────────────────────

  ┌──────────────────────────────────────────────────┬──────────┬───────────┐
  │  Document                                        │  Status  │  Notes    │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  README.md                                       │  STALE   │  Wave table│
  │                                                  │          │  shows W1–5│
  │                                                  │          │  pending;  │
  │                                                  │          │  needs     │
  │                                                  │          │  update    │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  docs/FEATURE-WAVE-0-SCAFFOLD.md                 │  current │            │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  docs/FEATURE-WAVE-1-SESSION.md                  │  current │            │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  docs/FEATURE-WAVE-2-ITUI-CANVAS.md              │  current │            │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  docs/features/FEATURE-WAVE-3-DAG-ORCHESTRATION  │  current │            │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  Wave 3.5 multi-LLM adapter layer                │  MISSING │  No feature│
  │                                                  │          │  doc exists│
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  docs/REVIEW-SECURITY-ARCHITECTURE-2026-04-27    │  current │  Wave 0–2  │
  │                                                  │          │  only; W3  │
  │                                                  │          │  not in    │
  │                                                  │          │  scope yet │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  .ai/memory/milestones.md                        │  current │            │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  .ai/project-index.yml                           │  current │            │
  ├──────────────────────────────────────────────────┼──────────┼───────────┤
  │  specs/docs/approvedPlans/                       │  current │  W0–W3     │
  │    2026-05-18-wave-4-terminal-panel.md           │  new     │  W4 plan   │
  └──────────────────────────────────────────────────┴──────────┴───────────┘

  Action items:
    1. Update README.md wave table (done below in this commit)
    2. Create docs/features/FEATURE-WAVE-3.5-MULTI-LLM.md (short-term)
    3. Bump package.json to 0.4.0 (done below)
    4. Security review update covering Wave 3 scope (Wave 5 milestone)

  Review process (per .ai/rules/doc-before-commit.md):
    • Every new file gets a project-index entry in the same commit.
    • Every wave closes with a feature doc in docs/features/.
    • All .md files carry <!-- version: x.y.z -->.
    • Approved plans saved to specs/docs/approvedPlans/ before implementation.
    • Rule 3 checklist: architecture diagram, legend, ≥2 scenario walkthroughs.

───────────────────────────────────────────────────────────────────────────────
## 10. INFRASTRUCTURE CONFIGURATION AUDIT
───────────────────────────────────────────────────────────────────────────────

  ╔══════════════════════════════════════════════════════════════════╗
  ║  Docker Compose   NOT PRESENT  (no docker-compose.yml)           ║
  ║  Ansible          NOT PRESENT  (no playbooks or inventory)       ║
  ║  CI/CD            NOT PRESENT  (no .github/workflows/)           ║
  ╚══════════════════════════════════════════════════════════════════╝

  This is an npm-published CLI tool. Deployment is:
    npm install -g agentfactory-harness
    factory

  There is no server component, no container runtime, and no managed
  infrastructure in scope for Waves 0–4.

  Infrastructure gaps (recommended for Wave 5+):
  ─────────────────────────────────────────────
  INFRA-01  No GitHub Actions CI. Tests run manually via npm test.
            Risk: regressions merged without test gate.
            Fix: add .github/workflows/ci.yml running vitest on push/PR.

  INFRA-02  No release automation. npm publish is manual.
            Fix: add release.yml triggered on git tag v*.*.*.

  INFRA-03  No dependabot or Renovate for dependency updates.
            @anthropic-ai/sdk evolves rapidly; silent version drift possible.

  INFRA-04  Wave 5 (registry) will introduce agentfactory.dev API calls.
            At that point a staging environment and API key rotation strategy
            will be needed. Document and implement before Wave 5 merges.

───────────────────────────────────────────────────────────────────────────────
## 11. SHORT-TERM & LONG-TERM ENHANCEMENTS
───────────────────────────────────────────────────────────────────────────────

  SHORT-TERM (before Wave 5 starts)
  ──────────────────────────────────
  • GAP-01 fix: sanitise {{}} in step outputs
  • GAP-04 fix: surface Zod errors in StatusBar
  • GAP-07 fix: bump package.json to 0.4.0  (done in this commit)
  • GAP-09 fix: SessionPanel welcome string uses VERSION constant
  • CommandPalette (Wave 1 leftover) — Ctrl+P overlay
  • INFRA-01 fix: add GitHub Actions CI

  LONG-TERM (Wave 5+)
  ────────────────────
  • GAP-02 fix: per-agent token budget + AbortSignal timeout
  • GAP-03 fix: BashTool sandboxing (firejail / chroot)
  • GAP-05 fix: session persistence to disk
  • GAP-08 fix: canvas scrollback / pan
  • Multi-PTY terminal panel (split sessions)
  • Clipboard integration (copy from session, paste into terminal)
  • Security review update covering Waves 3–4 findings

───────────────────────────────────────────────────────────────────────────────
## 12. WAVE 4 ADDITIONS — TerminalPanel / PTY Embed + Mouse Navigation
───────────────────────────────────────────────────────────────────────────────

  Wave 4 (PR #15, feature/wave-4-terminal) adds two capabilities:

  1. TERMINAL PANEL — real PTY shell embedded in the right column via node-pty.
     F4 / clicking the Terminal tab switches the right column from
     Orchestration+Agents to a full shell session.

  2. MOUSE NAVIGATION — tab bar and panel bodies are now clickable.
     Any left-click on a tab label or panel body changes the active tab.
     Works from all tabs including Terminal (where SGR mouse events are
     parsed for tab-bar hits before being suppressed from the PTY).

  New files:
    src/tui/input/vt.ts           — VTScreen ANSI state machine
    src/tui/input/vt.test.ts      — 27 unit tests
    src/tui/panels/TerminalPanel.ts      — node-pty panel
    src/tui/panels/TerminalPanel.test.ts — 7 lifecycle tests

  Modified files:
    src/tui/renderer/layout.ts    — PanelLayout gains terminal: Rect
    src/app.ts                    — 4th tab, mouse nav helpers, raw bypass

  VTScreen ANSI support added in Wave 4:
    • CR/LF/BS/BEL, soft-wrap, CUP/CUU/CUD/CUF/CUB/CHA/VPA
    • DECSTBM scroll regions, alternate screen (?1049h/l, ?47h/l)
    • Cursor visibility (?25h/l)
    • ED 0/1/2/3, EL 0/1/2
    • SGR: bold, dim, underline, reverse, 16-colour, 256-colour, truecolour
    • OSC ignored (title sequences)

  Gap status after Wave 4:
    ✓ resolved: VT-GAP-02 (alt-screen), VT-GAP-03 (scroll regions),
                VT-GAP-04 (VT100 F-keys), VT-GAP-05 (SGR mouse suppress),
                VT-GAP-08 (lazy spawn), VT-GAP-09 (PTY error banner)
    ○ open:     VT-GAP-01 (wide chars), VT-GAP-06 (scrollback),
                VT-GAP-07 (truecolour native)

  Full detail: docs/features/FEATURE-WAVE-4-TERMINAL-PANEL.md
