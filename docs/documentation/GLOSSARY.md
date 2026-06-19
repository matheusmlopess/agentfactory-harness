<!-- version: 1.0.0 -->
<!-- classification: REVIEW -->
<!-- review-type: REFERENCE -->
<!-- date: 2026-06-19 -->
<!-- last-updated: 2026-06-19 -->
<!-- status: ACTIVE -->

# Glossary — agentfactory-harness

Centralized definitions for acronyms and key terms used across the documentation. Use this for
quick lookups instead of searching individual docs. Terms are grouped; within a group they are
alphabetical.

> **Format**: `Term` — expansion / definition. *See also* points to the doc that covers it.

---

## Product & concepts

| Term | Definition |
|---|---|
| **factory** | The CLI binary / app (`agentfactory-harness`). No-args launches the TUI; subcommands run CLI mode. |
| **ITUI** | *Interactive TUI* — the product concept: a mouse-driven, drag-and-drop ASCII canvas for building/running agent orchestration plans inside the terminal. |
| **TUI** | *Terminal User Interface* — a full-screen text UI rendered with ANSI escape codes. |
| **Three planes** | Agent (chat loop) · Orchestration (DAG) · Registry (auth/keys). *See* [[00-overview]]. |
| **Wave (0–5)** | Development phases: 0 scaffold · 1 session · 2 canvas · 3 orchestration · 3.5 multi-LLM · 4 terminal · 5 registry. |
| **DDD** | *Design-Driven Development* — the `docs/ddd/` design reference set. |
| **Nobel-laureate naming** | Chat sessions are auto-named after Nobel laureates (a deliberate delight). |

## Rendering & terminal

| Term | Definition |
|---|---|
| **cell-buffer** | The custom renderer grid (`Cell[][]`); produces minimal-diff ANSI output. *See* [[02-rendering]]. |
| **diff (frame)** | `CellBuffer.diff(prev)` — emits only changed cells as escape sequences. |
| **ANSI** | Escape-code standard for terminal control (colors, cursor, mouse). |
| **SGR** | *Select Graphic Rendition* — ANSI codes for color/bold/underline (`38;5;n`, `38;2;r;g;b`). |
| **CSI** | *Control Sequence Introducer* — `ESC[` prefix for most escape codes. |
| **OSC** | *Operating System Command* — `ESC]`. **OSC 8** = hyperlinks; **OSC 52** = clipboard copy. |
| **PTY** | *Pseudo-terminal* — the OS device backing the embedded Terminal panel (`node-pty`). |
| **VTScreen / VT** | Virtual terminal emulator that parses PTY output into a cell grid. *See* [[03-input-focus]]. |
| **alt screen** | The alternate terminal screen buffer (`?1049h`) the TUI runs in. |
| **bracketed paste** | Terminal mode (`?2004h`) that frames pasted text so it isn't treated as keystrokes. |
| **focus model** | `activeTab` is the single focus source; keys go to the active panel, mouse to the panel under the cursor. |

## Agent runtime & data

| Term | Definition |
|---|---|
| **agentLoop** | The streaming LLM loop: send → stream → tool dispatch → repeat (`maxTurns` cap). *See* [[05-core-data]]. |
| **LLM** | *Large Language Model*. |
| **LLMAdapter** | Provider abstraction; converts canonical history to a provider's wire format and yields `StreamChunk`s. |
| **StreamChunk** | Normalized streaming event (`text_delta`, `tool_start`, `usage`, …). |
| **AgentEvent** | Events `agentLoop` yields (`text_delta`, `tool_result`, `stats`, …). |
| **Provider** | An LLM backend (`anthropic`, `openai`, and compat: deepseek/ollama/…). |
| **tool / dispatch** | Registered capabilities (Bash/Read/Write/WebFetch) run via `dispatch(name, input)`. |
| **hook** | Lifecycle callback (`PreToolUse`, `PostToolUse`, `StepStart`, `StepComplete`) run as `.ai/hooks/*.sh`. |
| **Session** | Conversation history (Anthropic `MessageParam` format) + token count. |
| **rollout** | Append-only JSONL session persistence (`~/.config/agentfactory/sessions/`); resume = replay. |
| **ConfigStore** | Persistent provider key store (`~/.config/agentfactory/config.json`). |
| **maxTurns / maxTokens** | Agent-loop limits (default 20 turns / 2048 tokens). |

## Orchestration

| Term | Definition |
|---|---|
| **DAG** | *Directed Acyclic Graph* — the step dependency graph of a plan. |
| **af-plan.json** | The orchestration plan format (DAG of single-agent steps). *See* [[FEATURE-WAVE-3-DAG-ORCHESTRATION-2026-05-01]]. |
| **af-team.json** | The multi-agent team format (roles, providers, handoffs, logic ports). *Planned* — *see* `docs/PLANS/`. |
| **Executor** | Runs the DAG: toposort, ready-set scheduling, bounded concurrency, cascade-skip. |
| **toposort / readySet** | Graph utilities: topological order / steps whose deps are all complete. |
| **StepEvent / StepStatus** | Executor outputs (`step:start/done/error/skipped/plan:done`) and states. |
| **Planner** | The `factory plan new` interactive wizard. |
| **interpolation (`{{id}}`)** | A step prompt placeholder replaced with a dependency's output. |

## Multi-agent (planned — `docs/PLANS/`)

| Term | Definition |
|---|---|
| **handoff / HandoffPackage** | Structured relay of one agent's result to the next (summary/full/outputs modes). |
| **logic ports** | DAG flow gates: **AND/OR/XOR/NAND**. |
| **AgentAsk** | A running agent pausing to ask the user a question asynchronously. |
| **MessageBus / SharedMemory** | In-process agent-to-agent messaging / namespaced runtime KV store. |
| **TeamExecutor** | Settlement-driven multi-agent scheduler. |
| **ToolUseContext / buildTool** | Tool context object / factory (the PLAN-CORE integration seam). |

## Registry & ops

| Term | Definition |
|---|---|
| **Registry (agentfactory.dev)** | The remote service for auth and key management. |
| **device login** | OAuth device-code flow (user code + verify URL). |
| **doctor** | `factory doctor` — environment health checks (Node, keys, token, `.ai/`, `CLAUDE.md`). |
| **SSOT** | *Single Source of Truth*. |

## Documentation system

| Term | Definition |
|---|---|
| **taxonomy** | The doc classification system. *See* `DOCUMENTATION-TAXONOMY.md`. |
| **classification** | The doc type marker: FEATURE / TESTING / DESIGN / GAPS / ANALYSIS / CHANGE / STUDY / REVIEW / ARCHITECTURE / SUMMARY / **PLAN**. |
| **date / last-updated** | Header markers: `date` is the creation date (immutable); `last-updated` changes on every edit. |
| **registry (docs)** | `DOCUMENTATION-REGISTRY.md` — the index of all docs; search before creating, register after. |
| **document PLAN** | A spec-driven plan in `docs/PLANS/` (classification: PLAN), *pending* approval. |
| **approved plan** | A CLI-approved plan in `specs/docs/approvedPlans/` (dated `YYYY-MM-DD-<name>.md`). |
| **promotion** | Moving an approved `docs/PLANS/PLAN-*` into `specs/docs/approvedPlans/` with the dated name. *See* [[REVIEW-DOCUMENTATION-WORKFLOW-2026-06-18]]. |
| **MENTAL-MAP** | The DDD orientation skeleton ([[MENTAL-MAP]]) — read first. |

---

## Acronym quick-list

`ANSI` · `CSI` · `DAG` · `DDD` · `ITUI` · `LLM` · `OSC` · `PTY` · `SGR` · `SSOT` · `TUI` · `VT`

---

*Add a term whenever a new acronym or domain word appears in a doc. Keep definitions to one line;
link the canonical doc with **See also**.*
