# Feature: Canvas Session Binding + Wire-Routing Crash Fix
<!-- version: 1.1.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-07-08 -->
<!-- last-updated: 2026-07-09 -->

## What it does

Fixes the canvas freeze/crash caused by an infinite loop in `routeWire()`
(vertical and near-vertical wires), and ties the three agent surfaces
together: canvas agent nodes are now backed by **real chat sessions** — they
appear in the Agents list the moment they are created, plan runs stream into
those sessions, and clicking an agent (list row or canvas block) opens its
conversation in the Session tab.

## Architecture

```
╔═══════════════════ Orchestration Canvas ═══════════════════╗
║  StudioModel (pure)                                        ║
║  ┌─────────────────────────────┐                           ║
║  │ StudioNode                  │   x-studio.sessions        ║
║  │  id · agent · prompt        │◄──────────────────────────╫── af-plan.json
║  │  sessionId? ────────────┐   │   (nodeId → sessionId)     ║
║  └─────────────────────────┼───┘                           ║
╚════════════════════════════┼═══════════════════════════════╝
                             │ CanvasSessionActions
                             │ (injected by canvas/index.ts)
                             ▼
╔══════════════════ services map (FeatureCtx) ═══════════════╗
║  'session' → SessionBridge                                 ║
║   metas() · switchToId(id) · createSession(name)           ║
║   resumeById(id) · postMessage(id, text)                   ║
╚════════════╦═══════════════════════════════╦═══════════════╝
             │                               │
             ▼                               ▼
╔═══════ SessionPanel ════════╗   ╔═══════ AgentsPanel ══════╗
║ SessionRecord[]             ║   ║ AgentEntry[] = projection ║
║  id = rollout id ───────────╫──►║ of metas() every frame    ║
║  session · lines · status   ║   ║ click row → switchTo(idx) ║
║  rollout (JSONL persist)    ║   ║          + switchTab      ║
╚═════════════════════════════╝   ╚══════════════════════════╝
```

| Symbol | Meaning |
|--------|---------|
| `╔═╗╚╝║` | Double-line box — top-level component boundary |
| `┌─┐└┘│` | Single-line box — internal detail or sub-component |
| `►` / `▼` | Data or control flow direction |
| `◄──╫──` | Serialization boundary (round-trip through af-plan.json) |
| `?` | Optional field |

Key files:

- `src/features/canvas/Wire.ts` — direction-safe L-wire router (crash fix)
- `src/features/canvas/panel.ts` — `CanvasSessionActions`, auto-bind in
  `addNode`, `openNodeSession`, `bindSession`, context-menu items, `o` key
- `src/features/canvas/index.ts` — actions wiring, bound-session plan runs
- `src/features/session/panel.ts` — `SessionMeta`, `switchToId`,
  `createSession`, `resumeById`, `postMessage`
- `src/features/session/index.ts` — extended `SessionBridge`
- `src/orchestration/studio-model.ts` + `schema.ts` — `sessionId` ↔
  `x-studio.sessions` round-trip
- `src/features/agents/index.ts` — click-to-open navigation
- `src/app.ts` — per-panel render guard (`renderTab` try/catch)

## How it works

### Scenario 1 — the wire-routing crash (fixed)

```
   before (hang)                       after
   from ○ (row 0, col 10)              from ○ (row 0, col 10)
        │  midCol == to.col                 │
        │  final loop:                      │
        │  c = to.col+1; c ≠ to.col;        │
        │  c++  → never terminates          ▼  arrow lands vertically
   to   ● (row 4, col 10)              to   ● (row 4, col 10)
```

| Symbol | Meaning |
|--------|---------|
| `○` | Output port (wire source) |
| `●` | Input port (wire target) |
| `│` | Vertical wire segment |
| `▼` | New vertical arrow head (no trailing horizontal run) |

1. The wire-drag preview routes from the output port to the **live mouse
   cursor** every frame. Dragging vertically made `midCol === to.col`, so the
   trailing horizontal loop (`c !== to.col` with a step moving *away*) never
   terminated — unbounded `points.push` → OOM kill. A fatal V8 OOM never
   reaches `uncaughtException`, which is why `/tmp/factory-err.log` stayed
   empty.
2. Fix: every loop steps by `Math.sign(end − start)` of its own segment; a
   zero-length segment skips its loop. `to.col === midCol` ends in `▼`/`▲`.
3. Corner glyphs now orient correctly for right-to-left and upward wires
   (`╭ ╮ ╰ ╯` chosen from the incoming/outgoing directions).
4. Defense in depth: `App.renderTab` wraps each panel render in try/catch —
   a throwing panel paints `⚠ <title> failed to render — see Logs` instead of
   killing the TUI. This catches *throws* only; non-terminating loops must be
   fixed at the source, as here.

### Scenario 2 — creating an agent box binds a real session

```
  toolbox drop / "Add agent block"
      │
      ▼
  addNode(id: agent-1) ──► createSessionFor('agent-1')
      │                        │  SessionPanel.createSession
      │                        │  (no focus steal)
      ▼                        ▼
  node.sessionId = sid    Agents list row "agent-1" appears
```

| Symbol | Meaning |
|--------|---------|
| `─►` / `▼` | Control flow |
| `sid` | Session id (rollout id — a JSONL file path) |

1. `addNode` asks the injected `CanvasSessionActions` to create a session
   named after the node id and stores the returned id on the node.
2. The session is a real `SessionRecord`, so the Agents list — a per-frame
   projection of `sessionMetas()` — shows it immediately.
3. `Ctrl+S` serializes the binding into `af-plan.json` under
   `x-studio.sessions`; loading the plan restores it.

### Scenario 3 — opening a session from a block or the Agents list

```
  canvas block                       Agents list row
  right-click → Open session          click
  or select + press o                  │
      │                                │
      ▼                                ▼
  openNodeSession(nodeId)          switchTo(idx)
      │  bound + live? ──► switchToId(sid)
      │  saved only?   ──► resumeById(sid) → rebind to fresh id
      │  dangling?     ──► createSessionFor(node) → bind
      ▼                                ▼
  switchTab('session')  ◄──────────────┘
  (conversation focused, ready to type)
```

| Symbol | Meaning |
|--------|---------|
| `─►` / `▼` / `◄──` | Control flow |
| `sid` | The node's bound session id |

1. **Bound and loaded** → `switchToId` activates it.
2. **Bound but only on disk** → `resumeById` replays the rollout into a new
   record (fresh id); the node is rebound to the fresh id.
3. **Unbound or unresolvable** → a new session is created and bound; opening
   a node's session never dead-ends.
4. Both paths finish with `switchTab('session')`, so the conversation is
   focused and interactive. Deleting a node keeps its session — the canvas
   does not own conversation history.

### Decision table — how a session id resolves at "open" time

The same resolution ladder backs the `o` key, the `Open session` menu item,
and the plan-run step launcher. It is deliberately **self-healing**: no state
of the binding can dead-end the user.

| Node state | What the code finds | Action taken | Binding afterwards |
|---|---|---|---|
| Bound, session loaded | `switchToId(sid)` → true | activate + `switchTab('session')` | unchanged |
| Bound, session only on disk | `switchToId` false, `resumeById(sid)` finds the rollout | replay events into a NEW record, activate it | **rebound to the fresh id** |
| Bound, rollout file gone | `switchToId` false, `resumeById` null | create session named after node, bind, open | rebound to the new session |
| Unbound | no `sessionId` on the node | create session named after node, bind, open | bound |
| No session bridge (headless) | `sessionActions` is null | no-op (`openNodeSession` returns) | unchanged |

### Scenario 4 — plan runs stream into visible sessions

```
  Ctrl+R ─► Executor.agentRunner(step)
               │ bridge registered?
               ├─ yes ─► node bound? ── no ─► createSession(step.id) + bind
               │            │ yes
               │            ▼
               │        postMessage(sid, step.prompt)
               │            │ streams into the SessionRecord
               │            ▼
               │        Agents list + Session tab show live output
               └─ no  ─► legacy throwaway Session (headless fallback)
```

| Symbol | Meaning |
|--------|---------|
| `─►` / `▼` | Control flow |
| `├─ / └─` | Branch |

1. Each step resolves its node's bound session (creating + binding one when
   missing or dangling, honoring the step's `model`/`provider`).
2. `postMessage` appends the prompt, runs the record's agent loop, and
   resolves with the assistant text the executor uses for `{{dep}}`
   interpolation. A busy session rejects → surfaces as a step error.
3. Without a session bridge (headless tests), the old throwaway path runs.

### Scenario 5 — validation, error handling, and recovery

```
  action                guard                        outcome on failure
  ──────                ─────                        ──────────────────
  Ctrl+S / Ctrl+R ────► validateStudio(model) ─────► status bar: "Plan invalid:
                        (fatal issues block)          <first fatal issue>"; no
                                                      write / no run
  postMessage ────────► rec found? ── no ──────────► rejects "No session with id …"
                        rec.streaming? ── yes ─────► rejects "Session … is busy"
                                                      → executor marks step error,
                                                      dependents cascade-skip
  open bound session ─► ladder in decision table ──► never dead-ends: resume or
                                                      create + rebind
  panel.render throws ► App.renderTab try/catch ───► panel area paints
                                                      "⚠ <title> failed to render
                                                      — see Logs"; app keeps
                                                      running; error logged ONCE
                                                      per distinct message
  load af-plan.json ──► PlanSchema (Zod) ──────────► status-bar error; canvas
                                                      stays empty; ENOENT silent
  bind menu, none ────► listSessions() empty and ──► menu simply not shown
  to list               node unbound
```

| Symbol | Meaning |
|--------|---------|
| `────►` | Control flow into the guard / outcome |
| `── no/yes ──` | Guard branch |

1. **Design-time validation** (`validateStudio`): empty plan name, no nodes,
   bad node id (must match `a-z0-9_-`), duplicate ids, empty agent/prompt,
   dangling or self-loop edges, dependency cycles — all fatal, all block
   save AND run with the first issue in the status bar. Session bindings are
   deliberately NOT validated here: the model stays session-agnostic and
   liveness is only decidable at open/run time.
2. **Run-time step errors**: a rejected `postMessage` (unknown id, busy
   session) becomes a failed step; the executor's normal cascade marks
   dependents `skipped`. The Agents team dashboard shows ✗ on the step; the
   bound session's transcript keeps everything streamed before the error.
3. **Render resilience**: a throwing panel no longer kills the TUI (the
   former behavior — `uncaughtException` → teardown). The guard cannot catch
   a non-terminating render; that class is fixed at the source in
   `routeWire` (every loop's step is `Math.sign(end − start)` of its own
   segment, so a zero-length segment never enters its loop).
4. **Crash forensics**: real throws land in the app log
   (`~/.config/agentfactory/logs/factory-YYYY-MM-DD.log`, deduped) and fatal
   ones in `/tmp/factory-err.log`. An empty `/tmp/factory-err.log` with a
   reported "crash" indicates a hang/OOM kill, not a throw — check for
   non-terminating loops first.

## Usage

```bash
# Launch the TUI
$ npm run dev

# Canvas (F2): press t, click "worker", click an empty cell → agent-1 box
#   → Agents (F3) now lists an "agent-1" session
# Right-click the box → Open session   (or select it and press o)
#   → Session tab focuses agent-1's conversation
# Right-click the box → Bind session…  → pick an existing session (★ = active)
# Ctrl+S → af-plan.json gains:
#   "x-studio": { "sessions": { "agent-1": "~/.config/agentfactory/sessions/…jsonl" } }
# Ctrl+R → each step runs inside its bound session, visible live in Agents

# Regression-test the wire fix
$ npx vitest run src/features/canvas/wire.test.ts
```

Concrete `af-plan.json` after binding (only the relevant extension shown —
the executor and CLI ignore `x-studio` entirely; old files without a
`sessions` key parse unchanged because the schema defaults it to `{}`):

```json
{
  "version": "1.0",
  "name": "untitled",
  "steps": [
    { "id": "agent-1", "agent": "worker", "prompt": "Implement: the parser", "dependsOn": [] }
  ],
  "x-studio": {
    "layout":   { "agent-1": { "row": 8, "col": 20 } },
    "edges":    [],
    "sessions": { "agent-1": "/home/you/.config/agentfactory/sessions/2026-07-08/agent-1-….jsonl" }
  }
}
```

Quick behavior probes from a REPL (no TTY needed):

```bash
# The two formerly-fatal wire geometries now terminate instantly
$ npx tsx -e "
import { routeWire } from './src/features/canvas/Wire.ts';
console.log(routeWire({row:0,col:10},{row:3,col:10}).map(p=>p.char).join(''));  // ││▼
console.log(routeWire({row:1,col:5},{row:4,col:4}).map(p=>p.char).join(''));    // ─╭││▼
"
```

## Test coverage

- `src/features/canvas/wire.test.ts` (15): both former hang cases, exhaustive
  small-grid termination/bound/duplicate fuzz, contiguity, corner orientation
  for all four L directions.
- `src/features/canvas/panel.test.ts` (+9): auto-bind on add (and skip without
  actions), `bindSession`/unbind, `o` key, unbound/dangling/resumed open
  flows, context-menu Open/Bind items, menu without actions.
- `src/features/session/panel.test.ts` (new, 7): unique stable ids, focus-safe
  `createSession`, `switchToId`, `resumeById` fresh-id semantics,
  `postMessage` resolve/unknown/busy — rollout, agent-loop, hooks, and LLM
  adapters mocked (no disk writes to the home dir, no network).
- `src/orchestration/studio-model.test.ts` (+2) / `schema.test.ts` (+2):
  `sessionId` round-trip, rename keeps binding, legacy plans default
  `sessions: {}`.
- Run: `npx vitest run` (47 files / 442 tests green).
- End-to-end procedure (tmux-driven, SGR mouse injection):
  `docs/testing/TESTING-CANVAS-SESSION-BINDING-2026-07-09.md`.
- NOT tested yet: the `App.renderTab` error-state paint (needs an app-level
  harness), live multi-step `Ctrl+R` streaming against a real provider.

## Known limitations

- A resumed session gets a **new** rollout id; the node rebinds on open, so a
  plan file saved earlier still points at the old id until re-saved.
- Session names follow the node id at bind time; renaming a node keeps the
  binding but does not rename the session.
- `postMessage` rejects when the target session is mid-stream; a plan step
  bound to a busy session errors rather than queueing.
- Deleting a node intentionally leaves its session in the Agents list.
