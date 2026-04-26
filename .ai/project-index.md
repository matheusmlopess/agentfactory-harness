# Project Index — agentfactory-harness
<!-- version: 1.0.0 -->
<!-- wave: 0 -->

> Agent navigation aid. Read this before searching `src/` or `.ai/`.
> Updated each wave: add rows for new files, flip `status` to `implemented` on merge.

## Quick nav

[TUI Renderer](#tui-renderer) · [TUI Input](#tui-input) · [TUI Panels](#tui-panels) ·
[TUI Widgets](#tui-widgets) · [Core / Agent Loop](#core--agent-loop) ·
[Orchestration](#orchestration) · [Harness](#harness) · [Registry](#registry) ·
[CLI](#cli) · [Governance](#governance) · [Docs](#docs) · [Config](#config)

---

## TUI Renderer

| Path | Purpose | Key exports | Wave | Status |
|------|---------|-------------|------|--------|
| `src/tui/renderer/ansi.ts` | Raw ANSI escape sequence builders — no dependencies | `ESC` `CSI` `enterAltScreen()` `exitAltScreen()` `clearScreen()` `hideCursor()` `showCursor()` `enableMouse()` `disableMouse()` `moveTo(row,col)` `sgr(...codes)` `reset()` `fg256(n)` `bg256(n)` `fgRgb()` `bgRgb()` `bold()` `dim()` `underline()` `reverse()` `clearLine()` `clearToEol()` | 0 | implemented |
| `src/tui/renderer/cell-buffer.ts` | Core renderer: `Cell[][]` grid, minimal-diff output, full repaint | `interface Cell` `class CellBuffer` — `write(row,col,text,style)` `fill(row,col,h,w,char,style)` `diff(prev):string` `flush():string` `clone():CellBuffer` | 0 | implemented |
| `src/tui/renderer/layout.ts` | Computes `Rect` panel regions from terminal dimensions; draws borders | `interface Rect` `interface PanelLayout` `computeLayout(rows,cols):PanelLayout` `drawBorder(buf,rect,title,focused)` | 0 | implemented |
| `src/tui/renderer/theme.ts` | 256-color palette constants + box-drawing char sets | `Colors` `Box` (single-line) `DBox` (double-line) `Wire` (wire chars) `Status` (symbols) | 0 | implemented |

---

## TUI Input

| Path | Purpose | Key exports | Wave | Status |
|------|---------|-------------|------|--------|
| `src/tui/input/keyboard.ts` | Raw stdin buffer → `KeyEvent`; drops mouse escape bytes | `interface KeyEvent` `parseKey(data:Buffer):KeyEvent\|null` | 0 | implemented |
| `src/tui/input/mouse.ts` | xterm SGR mouse event parser (`\033[<Pb;Px;PyM/m`) | `interface MouseEvent` `parseMouse(data:Buffer):MouseEvent\|null` | 2 | planned |
| `src/tui/input/router.ts` | Dispatches keyboard/mouse events to the currently focused panel | `class InputRouter` `dispatch(event,panels,focused)` | 2 | planned |

---

## TUI Panels

| Path | Purpose | Key exports | Wave | Status |
|------|---------|-------------|------|--------|
| `src/tui/panels/Panel.ts` | Abstract base class for all panels | `abstract class Panel` — `rect:Rect` `focused:boolean` `abstract render(buf)` `onKey(e)` `onMouse(e)` `get inner():Rect` | 0 | stub |
| `src/tui/panels/StatusBar.ts` | Bottom status line — version, mode label, keybind hints | `renderStatusBar(buf:CellBuffer,rect:Rect,mode?:string):void` | 0 | implemented |
| `src/tui/panels/SessionPanel.ts` | Chat panel — streaming Claude output, user input bar | `class SessionPanel extends Panel` | 1 | planned |
| `src/tui/panels/OrchestrationCanvas.ts` | ITUI drag-drop canvas — block layout, wire draw, mouse interactions | `class OrchestrationCanvas extends Panel` `CanvasState` `Block` `Wire` `DragState` | 2 | planned |
| `src/tui/panels/AgentsPanel.ts` | Agent list sidebar — live status badges | `class AgentsPanel extends Panel` | 1 | planned |
| `src/tui/panels/TerminalPanel.ts` | node-pty embed — real shell inside a panel region | `class TerminalPanel extends Panel` | 4 | planned |

---

## TUI Widgets

| Path | Purpose | Key exports | Wave | Status |
|------|---------|-------------|------|--------|
| `src/tui/widgets/Block.ts` | ASCII box for one agent node — title, version, status, ports | `class Block` `renderBlock(buf,block,focused)` | 2 | planned |
| `src/tui/widgets/Wire.ts` | L-shaped wire router between output/input ports | `class Wire` `routeWire(from,to):WirePath` | 2 | planned |
| `src/tui/widgets/ContextMenu.ts` | Right-click popup — action list, keyboard nav | `class ContextMenu` | 2 | planned |
| `src/tui/widgets/CommandPalette.ts` | Ctrl+P fuzzy-search overlay | `class CommandPalette` | 1 | planned |

---

## Core / Agent Loop

| Path | Purpose | Key exports | Wave | Status |
|------|---------|-------------|------|--------|
| `src/core/agent-loop.ts` | Claude streaming loop — sends messages, handles tool calls | `class AgentLoop` `run(messages):AsyncIterable<Event>` | 1 | planned |
| `src/core/session.ts` | Conversation history, token tracking, context management | `class Session` `addMessage()` `getHistory()` `tokenCount` | 1 | planned |
| `src/core/hooks.ts` | Hook runner — PreToolUse PostToolUse SessionStart SessionStop StepStart StepComplete AgentSpawn | `runHook(event,ctx):Promise<HookResult>` | 1 | planned |
| `src/core/tools/index.ts` | Tool registry and dispatcher | `registerTool()` `dispatch(name,input)` | 1 | planned |
| `src/core/tools/bash.ts` | Bash tool — child_process exec with timeout | `BashTool` | 1 | planned |
| `src/core/tools/read.ts` | Read tool — filesystem file reader | `ReadTool` | 1 | planned |
| `src/core/tools/write.ts` | Write tool — filesystem file writer | `WriteTool` | 1 | planned |
| `src/core/tools/web-fetch.ts` | WebFetch tool — HTTP GET with body extraction | `WebFetchTool` | 1 | planned |
| `src/core/tools/agent.ts` | Agent tool — spawns a sub-session | `AgentTool` | 1 | planned |

---

## Orchestration

| Path | Purpose | Key exports | Wave | Status |
|------|---------|-------------|------|--------|
| `src/orchestration/schema.ts` | af-plan.json Zod schema — `PlanSchema` `StepSchema` | `PlanSchema` `StepSchema` `Plan` `Step` (inferred types) | 3 | planned |
| `src/orchestration/executor.ts` | DAG topological sort + step runner — live status events | `class Executor` `run(plan):AsyncIterable<StepEvent>` | 3 | planned |
| `src/orchestration/planner.ts` | `/plan new` interactive wizard — prompts → writes af-plan.json | `class Planner` `wizard():Promise<Plan>` | 3 | planned |
| `src/orchestration/graph.ts` | DAG utilities — topological sort, cycle detection | `toposort(steps):string[]` `detectCycles(steps):string[][]` | 3 | planned |

---

## Harness

| Path | Purpose | Key exports | Wave | Status |
|------|---------|-------------|------|--------|
| `src/harness/doctor.ts` | Environment health checks (Node version, API key, token file, .ai/, CLAUDE.md) | `interface CheckResult` `runDoctor(cwd:string):CheckResult[]` `printDoctorReport(results):void` | 0 | implemented |
| `src/harness/reader.ts` | `.ai/` directory traversal — loads harness files | `readHarness(root:string):HarnessContext` | 5 | planned |
| `src/harness/manifest.ts` | agent-manifest.json types and parser | `interface AgentManifest` `parseManifest(path):AgentManifest` | 5 | planned |

---

## Registry

| Path | Purpose | Key exports | Wave | Status |
|------|---------|-------------|------|--------|
| `src/registry/client.ts` | agentfactory.dev REST client — publish, fetch, list | `class RegistryClient` `publish(agent)` `fetch(slug)` | 5 | planned |
| `src/registry/auth.ts` | Token auth — reads `~/.agentfactory/token` | `getToken():string\|null` `saveToken(t)` | 5 | planned |

---

## CLI

| Path | Purpose | Key exports | Wave | Status |
|------|---------|-------------|------|--------|
| `src/index.ts` | Binary entry point — routes args to commander or `App.start()` | `VERSION` | 0 | implemented |
| `src/cli.ts` | Commander program definition — `doctor` subcommand, `--version` flag | `buildCli(version:string):Command` | 0 | implemented |
| `src/app.ts` | `App` class — terminal lifecycle, render loop, keyboard input loop | `class App` — `start()` `stop()` | 0 | implemented |

---

## Governance

| Path | Purpose | Version | Status |
|------|---------|---------|--------|
| `.ai/AgentFactory.md` | Master project brief — overview, wave plan, behavior rules, search protocol | 1.0.0 | implemented |
| `.ai/project-index.md` | **This file** — complete file map for agent navigation | 1.0.0 | implemented |
| `.ai/adapters/claude/brief.md` | Claude Code intelligence brief — enforced rules, key files, slash commands | 1.0.0 | implemented |
| `.ai/rules/approved-plans.md` | Rule 1: every plan saved to `specs/docs/approvedPlans/` before implementation | 1.0.0 | implemented |
| `.ai/rules/worktree-first.md` | Rule 2: every feature in a dedicated git worktree branched from main | 1.0.0 | implemented |
| `.ai/rules/doc-before-commit.md` | Rule 3: full feature doc before commit — diagrams, legends, scenarios required | 1.1.0 | implemented (worktree) |
| `.ai/memory/milestones.md` | Living wave tracker — W0 done, W1–W5 pending | 1.0.0 | implemented |
| `CLAUDE.md` | Symlink → `.ai/adapters/claude/brief.md` | — | implemented |

---

## Docs

| Path | Purpose | Wave | Status |
|------|---------|------|--------|
| `README.md` | Public project overview — ITUI concept, install, keyboard shortcuts, wave plan | 0 | implemented |
| `docs/FEATURE-WAVE-0-SCAFFOLD.md` | Full Wave 0 feature doc — architecture, rendering pipeline, layout, doctor, usage, tests | 0 | implemented |
| `specs/docs/approvedPlans/2026-04-26-wave-0-scaffold.md` | Approved plan for Wave 0 | 0 | implemented |

---

## Config

| Path | Purpose | Key values |
|------|---------|-----------|
| `package.json` | npm metadata, scripts, dependencies | `bin: { factory: ./dist/index.js }` · scripts: `dev` `build` `test` |
| `tsconfig.json` | TypeScript config | `strict: true` `noUncheckedIndexedAccess` `exactOptionalPropertyTypes` `NodeNext` |
| `.gitignore` | Git ignore patterns | `node_modules/` `dist/` `.env` |

---

## Maintenance contract

- **New file added** → new row in the same commit, same PR
- **File deleted or renamed** → row updated in the same commit
- **Wave merged** → flip `status` from `planned` → `implemented`; bump `<!-- wave: N -->`
- **Version marker** → bump minor on each wave, patch on single-file additions
