# MENTAL MAP — `factory` (agentfactory-harness)

<!-- version: 1.0.0 -->
<!-- classification: DESIGN -->
<!-- date: 2026-06-18 -->
<!-- last-updated: 2026-06-18 -->
<!-- READ ME FIRST. Orientation skeleton for design/exploration agents. -->
<!-- Complements .ai/project-index.yml (file-oriented). This map is design/behaviour-oriented. -->

## What it is (30 seconds)

`factory` is a **full-screen TypeScript TUI** — an "ITUI" (Interactive TUI) orchestration shell
for AI agents. Custom ANSI cell-buffer renderer (no Ink/blessed). Run model:

- `factory` (no args) → launches the full-screen **App** (alt-screen TUI).
- `factory <subcommand>` → **CLI** path (`doctor`, `run`, `plan new|validate`, `--version`).

Single binary `factory` → `dist/index.js`. ESM, Node ≥20.

## Layer skeleton

```
src/
├── index.ts            entry — branch: TUI App vs CLI (commander)
├── cli.ts              command tree: doctor · run · plan new|validate
├── app.ts              HOST god-object: render loop, input routing, tabs/focus, status-bar hit-test
│
├── tui/                ── presentation platform ──
│   ├── renderer/       cell-buffer · ansi · layout · theme   (the paint engine)
│   ├── input/          keyboard · mouse · router · vt        (stdin → events; PTY emulator)
│   ├── panels/         Panel base + Session · Orchestration · Agents · Terminal · Config · Logs · StatusBar
│   └── widgets/        Block · Wire · ContextMenu · CommandPalette · ScrollableList
│
├── core/               ── runtime / data ──
│   ├── agent-loop.ts   streaming LLM loop + tool dispatch + hooks
│   ├── session.ts      conversation history (Anthropic MessageParam format)
│   ├── hooks.ts        shell-based lifecycle hooks (.ai/hooks/*.sh)
│   ├── tools/          registry + Bash · Read · Write · WebFetch (+ agent, not registered)
│   ├── llm/            LLMAdapter · Anthropic · OpenAI · createAdapter/defaultProvider/listModels
│   ├── config/         ConfigStore (~/.config/agentfactory/config.json) + 35 PROVIDERS
│   ├── logger.ts       leveled logging + 500-entry ring buffer + dated file
│   └── rollout.ts      append-only JSONL session persistence (resume = replay)
│
├── orchestration/      ── DAG plane ──
│   schema.ts (af-plan.json Zod) · executor.ts (toposort+concurrency) · graph.ts · planner.ts
│
├── harness/            doctor.ts (7 env checks)   [reader/manifest planned]
└── registry/           auth · client · login (device flow) · import-keys
```

## File → responsibility → key symbols (the fast index)

| File | Responsibility | Key symbols |
|---|---|---|
| `src/index.ts` | entry; TUI-vs-CLI branch; `VERSION` | `VERSION` (0.3.0 ⚠) |
| `src/cli.ts` | command tree | `buildCli`, doctor/run/plan |
| `src/app.ts` | host: render loop, input, tabs/focus, hit-test | `App`, `scheduleRender`, `render`, `listenInput`, `TABS`, `ensureTerminalPanel` |
| `tui/renderer/cell-buffer.ts` | frame grid + minimal-diff output | `CellBuffer`, `Cell`, `diff`, `flush`, `clone` |
| `tui/renderer/ansi.ts` | escape builders | `enterAltScreen`, `enableMouse`, `moveTo`, `sgr`, `osc8*`, `osc52Copy` |
| `tui/renderer/layout.ts` | panel regions + borders | `Rect`, `PanelLayout`, `computeLayout`, `drawBorder` |
| `tui/renderer/theme.ts` | palette + box/wire/status chars | `Colors`, `Box`, `DBox`, `Wire`, `Status` |
| `tui/input/keyboard.ts` | stdin → KeyEvent | `KeyEvent`, `parseKey` |
| `tui/input/mouse.ts` | SGR mouse parse | `MouseEvent`, `parseMouse` |
| `tui/input/router.ts` | dispatch to focused/hit panel | `InputRouter.dispatch` |
| `tui/input/vt.ts` | PTY virtual terminal | `VTScreen`, `feed`, `render`, scrollback |
| `tui/panels/Panel.ts` | abstract base | `Panel`, `rect`, `focused`, `inner`, `render/onKey/onMouse` |
| `tui/panels/SessionPanel.ts` | chat + multi-session + pickers | `SessionPanel`, `runAgentLoop`, `SLASH_COMMANDS`, `SessionRecord` |
| `tui/panels/OrchestrationCanvas.ts` | DAG canvas (drag/wire) | `OrchestrationCanvas`, `syncFromPlan`, `applyStepEvent`, `CanvasWire` |
| `tui/panels/AgentsPanel.ts` | session list + stats | `AgentsPanel`, `AgentEntry`, `setAgents`, `updateAgent` |
| `tui/panels/ConfigPanel.ts` | provider key manager | `ConfigPanel`, `maskValue`, edit/login/import overlays |
| `tui/panels/LogsPanel.ts` | logs + metrics + AI insights | `LogsPanel`, `startInsights`, two-column |
| `tui/panels/TerminalPanel.ts` | node-pty + VTScreen bridge | `TerminalPanel`, `write`, `scrollBack` |
| `tui/panels/StatusBar.ts` | bottom bar (function) | `renderStatusBar`, `StatusBarLayout` |
| `tui/widgets/CommandPalette.ts` | Ctrl+P fuzzy commands | `CommandPalette`, `fuzzyScore`, `PaletteCommand` |
| `tui/widgets/ContextMenu.ts` | right-click popup | `ContextMenu`, `MenuItem` |
| `tui/widgets/ScrollableList.ts` | reusable list | `ScrollableList`, `ListRow` |
| `tui/widgets/Block.ts` / `Wire.ts` | canvas node + wire (pure render) | `renderBlock`, `routeWire` |
| `core/agent-loop.ts` | streaming loop | `agentLoop`, `AgentEvent`, `AgentLoopOptions` |
| `core/session.ts` | history | `Session`, `tokenCount` |
| `core/hooks.ts` | lifecycle hooks | `runHook`, `HookEvent`, `HookResult` |
| `core/tools/index.ts` | registry + dispatch | `Tool`, `registerTool`, `dispatch`, `listTools` |
| `core/llm/types.ts` / `index.ts` | adapter contract + factory | `LLMAdapter`, `StreamChunk`, `createAdapter`, `defaultProvider`, `listModels` |
| `core/config/store.ts` / `providers.ts` | key store + provider defs | `store`, `getKey`, `setKey`, `PROVIDERS` |
| `core/logger.ts` / `rollout.ts` | logging + persistence | `logger`, `getRecentLogs`, `rolloutStore` |
| `orchestration/schema.ts` | plan schema | `PlanSchema`, `StepSchema` |
| `orchestration/executor.ts` | DAG executor | `Executor`, `StepEvent`, `StepStatus` |
| `orchestration/graph.ts` | DAG utils | `toposort`, `detectCycles`, `readySet` |
| `harness/doctor.ts` | env checks | `runDoctor`, `printDoctorReport` |
| `registry/{auth,client,login,import-keys}.ts` | registry + device login | `getToken`, `decodeUser`, `startDeviceLogin` |

## "Where do I look for X?"

| I want to… | Go to |
|---|---|
| Understand how a frame is painted | `cell-buffer.ts` `diff()` + `app.ts` `render()`/`scheduleRender()` |
| Add a panel / tab | `app.ts` (`TABS`, `initPanels`, render branch, input routing) — see 11-feature-isolation for the cleaner path |
| Add a tool | `core/tools/` + `registerTool` in `app.ts` |
| Handle a key globally | `app.ts` `listenInput` (keyboard section) |
| Understand focus | `app.ts` `activeTab` + `router.ts` (key→focused, mouse→hit-test) |
| Add an LLM provider key | `core/config/providers.ts` (`PROVIDERS`) |
| Persist / resume a session | `core/rollout.ts` + `SessionPanel` `resumeFrom` |
| Change colors | `tui/renderer/theme.ts` `Colors` |
| Edit the chat/agent loop | `core/agent-loop.ts` |
| Run a DAG plan | `orchestration/executor.ts` + `cli.ts` `run` |

## Critical invariants & gotchas

1. **Event-driven render, NO fixed tick.** State changes call `scheduleRender()` →
   `renderPending` flag + `setImmediate` coalesce → one `render()` per tick. Direct user
   actions often call `render()` synchronously. The only timers are Logs feature timers.
2. **`activeTab` IS the focus.** One source of truth. Keys go to the active panel; mouse goes
   to the panel whose rect contains the click.
3. **Only `[session, canvas, agents]` go through `InputRouter`.** Config, Logs, and Terminal
   are dispatched **explicitly** in `app.ts` (don't assume the router covers them).
4. **Terminal tab = raw-byte bypass.** stdin bytes go straight to the PTY; only Ctrl+Q/Ctrl+P/
   F1–F5/Shift+PgUp-Dn/tab-bar clicks are intercepted.
5. **One UTF-16 unit per cell.** Emoji are sanitized to ASCII in SessionPanel; wide (CJK/emoji)
   chars are handled specially only in `VTScreen`. Don't put multi-codepoint glyphs in cells.
6. **`agent` tool is deliberately NOT registered** in the interactive loop (its Zod schema
   would reject the model's input). See `cli.ts` comment.
7. **`app.ts` is a ~1100-line god object** (render + input + status-bar hit-testing). Most
   "wiring" lives here, not in the panels.
8. **Version string is inconsistent**: `package.json` 0.4.0, `index.ts` VERSION 0.3.0 (what
   `--version` prints), StatusBar 0.4.0.

## Data / file locations

| What | Path |
|---|---|
| Provider keys/urls | `~/.config/agentfactory/config.json` |
| Logs (dated) | `~/.config/agentfactory/logs/factory-<YYYY-MM-DD>.log` |
| Session rollouts (JSONL) | `~/.config/agentfactory/sessions/<YYYY-MM-DD>/rollout-*.jsonl` |
| Registry token | `~/.agentfactory/token` |
| Orchestration plan | `./af-plan.json` (cwd) |
| Harness context | `./.ai/` + `./CLAUDE.md` |

## Known-quirk warning

Several **intended** quirks look like bugs (per-panel scroll-wheel semantics differ, vim keys
only in Logs, Nobel-laureate session names + tooltip). Before "fixing", read
[`09-gaps.md`](09-gaps.md) — it classifies which are intended vs real issues.

## See also

- `.ai/project-index.yml` — machine-readable file index (path · purpose · exports · wave · status).
- This DDD set: [`INDEX.md`](INDEX.md) for the full table of contents.
