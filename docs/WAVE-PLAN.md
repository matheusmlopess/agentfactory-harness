<!-- version: 1.0.0 -->
# Wave Plan — AgentFactory Harness

Complete feature roadmap with implementation status, milestones, and future work.

---

## Overview

AgentFactory Harness (`factory`) is built in waves, each adding a distinct capability:

| Wave | Status | Focus | Key Files |
|------|--------|-------|-----------|
| **0** | ✓ Done | Scaffold | cell-buffer, ANSI, layout, doctor |
| **1** | ✓ Done | Session | agent-loop, tools, hooks, commands |
| **2** | ✓ Done | Canvas | mouse, blocks, wires, drag-drop |
| **3** | ✓ Done | Orchestration | DAG executor, planner, `/run` |
| **3.5** | ✓ Done | Multi-LLM | Anthropic + OpenAI adapters |
| **4** | ✓ Done | Terminal | PTY embed, VTScreen, node-pty |
| **5** | ✓ Done | Registry | Auth, login, key import, multi-session |
| **5.5** | 🚧 Planned | Harness | Reader, manifest parser |
| **6** | 📋 Planned | Skills | Skill creation, marketplace |

---

## Wave 0 — Scaffold ✓ DONE (Apr 2026)

**Goal**: Build the foundation: raw ANSI renderer, cell-buffer, terminal layout, basic doctor.

**What it does**:
- Custom `CellBuffer` with minimal-diff rendering (no TUI framework)
- ANSI escape builders for colors, cursor, text attributes
- Terminal layout computation (panel regions)
- `factory doctor` command for environment health checks

**Key files**:
- `src/tui/renderer/` — cell-buffer, ansi, layout, theme
- `src/harness/doctor.ts` — environment checks
- Tests: 4 cell-buffer, 15 keyboard, 14 mouse

**Features**:
- 256-color + truecolor support
- Box-drawing characters (single + double)
- Click detection (SGR mode 1003 mouse)

---

## Wave 1 — Session ✓ DONE (Apr 2026)

**Goal**: Stream Claude responses, execute tools, manage chat history.

**What it does**:
- Streaming agent loop with tool calling
- Session history + token tracking
- 7 slash commands (`/model`, `/chat`, `/clear`, `/tokens`, etc.)
- Hooks for Pre/PostToolUse, SessionStart, SessionStop

**Key files**:
- `src/core/agent-loop.ts` — streaming + tool dispatch
- `src/core/session.ts` — history, tokens
- `src/tui/panels/SessionPanel.ts` — chat rendering
- `src/core/tools/` — Bash, Read, Write, WebFetch

**Features**:
- Multi-turn agent conversations
- Tool error recovery (concise feedback)
- Token accounting (real counts from provider)
- Copy mode (Ctrl+E, OSC 52 clipboard)

**Tests**: 21 total (agent-loop, session, tools)

---

## Wave 2 — ITUI Canvas ✓ DONE (Apr 2026)

**Goal**: Drag-and-drop ASCII blocks, wire them into agent DAGs visually.

**What it does**:
- Orchestration canvas with draggable agent blocks
- L-shaped wire routing between ports
- Right-click context menus
- Real-time visual feedback (highlighted blocks, wires)

**Key files**:
- `src/tui/panels/OrchestrationCanvas.ts` — block layout, drag state
- `src/tui/widgets/Block.ts` — ASCII box rendering
- `src/tui/widgets/Wire.ts` — wire routing algorithm
- `src/tui/input/router.ts` — mouse event dispatch

**Features**:
- Block position snapping
- Wire collision avoidance
- Multi-block selection (future)
- Live canvas status (idle/running/done/error)

**Tests**: 15 canvas, 6 wire, 20+ input

---

## Wave 3 — Orchestration ✓ DONE (May 2026)

**Goal**: Execute orchestration plans (af-plan.json), run DAGs, live status.

**What it does**:
- Zod-validated `af-plan.json` schema
- Topological sort + DAG cycle detection
- Cascade-skip on step failure
- `/run` command with live canvas status
- Step interpolation (variable substitution)

**Key files**:
- `src/orchestration/schema.ts` — Zod plan/step types
- `src/orchestration/executor.ts` — async iterator executor
- `src/orchestration/graph.ts` — toposort, cycle detect, readySet
- `src/orchestration/planner.ts` — interactive plan wizard

**Features**:
- Parallel step execution (fan-out on independence)
- Variable interpolation (`${step.output}`)
- Error cascade (skip downstream on failure)
- Live step status on canvas (idle → running → done/error)

**Tests**: 9 executor, 14 graph, 3 planner, 14 schema

---

## Wave 3.5 — Multi-LLM ✓ DONE (May 2026)

**Goal**: Support Anthropic (default) + OpenAI, dynamic model picker.

**What it does**:
- Adapter pattern: `AnthropicAdapter` + `OpenAIAdapter`
- Model picker (two-step: provider → model)
- Live model list fetching from API
- o-series max_completion_tokens support

**Key files**:
- `src/core/llm/index.ts` — createAdapter, listModels
- `src/core/llm/anthropic-adapter.ts` — Anthropic streaming
- `src/core/llm/openai-adapter.ts` — OpenAI streaming
- `src/tui/panels/SessionPanel.ts` — model picker UI

**Features**:
- Dynamic model list from API (cached)
- Fallback to static model list
- Provider auto-detection from env vars
- Status bar model tag (clickable)

**Tests**: 3 anthropic-adapter, 3 openai-adapter, 6 llm/index

---

## Wave 4 — Terminal ✓ DONE (May 2026)

**Goal**: Embed a real interactive shell inside the TUI.

**What it does**:
- `node-pty` integration with shell spawning
- `VTScreen` — streaming ANSI parser into the cell-buffer
- Raw PTY input bypass (F4 tab, mouse intercept)
- Resize/destroy lifecycle management

**Key files**:
- `src/tui/panels/TerminalPanel.ts` — PTY lifecycle
- `src/tui/input/vt.ts` — VTScreen ANSI parser
- `src/tui/renderer/layout.ts` — terminal rect
- `src/app.ts` — PTY input bypass, F4 tab

**Features**:
- Full shell interactivity (stdin/stdout passthrough)
- Scroll regions (CSI commands)
- SGR color + cursor rendering
- Mouse events in terminal (xterm SGR)
- Alt-screen handling

**Tests**: 41 VT parser, 9 terminal-panel, 16 terminal-bypass

---

## Wave 5 — Registry Auth ✓ DONE (Jun 2026)

**Goal**: Log in to agentfactory.dev, import API keys, multi-session persistence.

**What it does**:
- Device-code authentication flow → JWT token
- API key import from `~/.claude/.credentials.json` + env vars
- JSONL session persistence (Codex-style rollout files)
- Multi-session with Nobel laureate naming
- `/resume` slash command to reload sessions

**Key files**:
- `src/registry/auth.ts` — token storage, JWT decode
- `src/registry/client.ts` — Bearer auth fetch wrapper
- `src/registry/login.ts` — device-code polling
- `src/registry/import-keys.ts` — key scanning
- `src/core/rollout.ts` — JSONL persistence
- `src/tui/panels/ConfigPanel.ts` — login/import overlays

**UI Improvements**:
- Multi-line prompt bar soft-wrap (up to 5 rows)
- Tool toggle (`[tools]/[chat]`) moved to status bar
- Model selector on status bar (clickable)
- Clean prompt input area (text-only)

**Features**:
- Device-code login with countdown timer
- Auto-open browser during login
- Import candidate selection + deduplication
- Session naming from Nobel laureates
- Session list with newest-first sorting
- Append-only JSONL for crash safety

**Tests**: 269 total (21 new: 6 client, 5 import-keys, 6 login, 4 rollout, 6 nobel)

---

## Wave 5.5 — Harness Integration 🚧 PLANNED

**Goal**: Load `.ai/` harness context (agent manifests, rules, briefs).

**What it does**:
- `.ai/` directory traversal (read rules, agents, briefs)
- Agent manifest parsing (agent-manifest.json)
- Harness context available to orchestration plans
- Doctor checks for `.ai/` structure

**Key files** (to implement):
- `src/harness/reader.ts` — `.ai/` traversal, context loading
- `src/harness/manifest.ts` — agent-manifest.json Zod schema
- `.ai/rules/` — enforced rules (approved-plans, worktree-first, doc-before-commit, etc.)

**Planned features**:
- Validate plans against harness rules
- Pre-load agent metadata before orchestration
- Display harness brief in UI (what agents are available)
- Doctor validates `.ai/` directory structure

**Estimated tests**: 8–10 (reader, manifest, doctor extensions)

---

## Wave 6 — Skills & Marketplace 📋 PLANNED

**Goal**: Build and publish reusable agent skills.

**What it does**:
- Skill scaffold generator (`agentfactory-gen skill`)
- Skill registration in `.ai/skills/`
- Registry integration: search, download, install skills
- Skill marketplace browser (in-app)
- `/skill <name>` command to load skills

**Key files** (to implement):
- `src/registry/skills.ts` — skill CRUD, listing
- `src/tui/panels/SkillMarketplace.ts` — marketplace browser
- CLI commands for skill creation/installation

**Planned features**:
- Skill versioning + dependency resolution
- One-click skill installation
- Skill authorship governance (author profile)
- Skill ratings + reviews (future)

**Estimated tests**: 15–20

---

## Wave 7 — Agents & Orchestration UI 📋 FUTURE

**Goal**: Create agents graphically, test them in the canvas, export to af-plan.json.

**What it does**:
- Agent designer (define inputs, outputs, tools, model)
- Template library for common agent patterns
- Canvas node creation UI (right-click → "New Agent")
- Agent versioning + git integration

**Estimated work**: Q4 2026+

---

## Wave 8 — Collaboration & Sharing 📋 FUTURE

**Goal**: Share orchestration plans, agents, and sessions.

**What it does**:
- Plan export/import via registry
- Public agent marketplace
- Session sharing (read-only replay)
- Team workspaces

**Estimated work**: 2027+

---

## Known Gaps

### By Wave

| Wave | Gap | Scope | Effort |
|------|-----|-------|--------|
| 5 | Token refresh | JWT expiry handling | Low |
| 5 | OAuth/OIDC | Alternative auth methods | Medium |
| 5 | Credential encryption | Plaintext token at 0o600 | Medium |
| 5.5 | Project sessions | Group sessions by cwd/project (GH #21) | Low–Medium |
| 6+ | Skill marketplace | Full registry, reviews, ratings | High |
| 7+ | Agent designer | Visual agent builder | High |
| 8+ | Collaboration | Plan sharing, team workspaces | Very High |

---

## Future Enhancements (Backlog)

### Short-term (Q3 2026)

- **Project Sessions** (GH #21) — group multiple sessions under a named project
- **Session search** — find past sessions by content/date
- **Better error messages** — more specific recovery guidance
- **Theme switcher** — dark/light, colorblind modes

### Medium-term (Q4 2026)

- **Agent template library** — pre-built agents for common tasks
- **Plan history** — browse and re-run past orchestrations
- **Skill marketplace UI** — browse, rate, install skills
- **Export to Markdown** — session transcripts, plan diagrams

### Long-term (2027+)

- **Mobile app** — companion mobile UI for session replay
- **Web dashboard** — cloud-hosted plan management
- **Team workspaces** — invite collaborators, shared plans
- **Webhook integration** — trigger runs from CI/CD
- **Audit logging** — compliance + debugging

---

## Testing & Quality

- **Target coverage**: 80%+ per wave
- **Test framework**: Vitest
- **Type safety**: TypeScript strict mode, no `any`
- **CI/CD**: Pre-commit hooks, GitHub Actions
- **Performance**: Sub-100ms render latency (cell-buffer diff)

### Test Summary by Wave

| Wave | Unit Tests | Integration | E2E | Coverage |
|------|-----------|------------|-----|----------|
| 0 | 19 | — | — | 85% |
| 1 | 21 | — | — | 82% |
| 2 | 26 | — | — | 88% |
| 3 | 26 | — | — | 86% |
| 3.5 | 6 | — | — | 84% |
| 4 | 66 | — | — | 89% |
| 5 | 21 | — | — | 87% |
| **Total** | **269** | — | — | **86%** |

---

## Release Timeline

| Version | Wave | Status | Date |
|---------|------|--------|------|
| 0.1.0 | 0 | ✓ Released | Apr 2026 |
| 0.2.0 | 1 | ✓ Released | Apr 2026 |
| 0.3.0 | 2 | ✓ Released | Apr 2026 |
| 0.4.0 | 3–3.5 | ✓ Released | May 2026 |
| 0.5.0 | 4 | ✓ Released | May 2026 |
| 0.6.0 | 5 | ✓ Released | Jun 2026 |
| 0.7.0 | 5.5 | 🚧 In progress | Jun 2026 |
| 1.0.0 | 6 | 📋 Planned | Q4 2026 |

---

## How to Contribute

See `.ai/rules/` for governance:
- **Rule 1**: Every feature starts with an approved plan
- **Rule 2**: Features in dedicated git worktrees
- **Rule 3**: Full docs before merge (diagrams, tests, scenarios)
- **Rule 4**: TypeScript strict, 80%+ test coverage

To implement a wave:

1. Read this doc + `spec/docs/approvedPlans/` for that wave
2. Create a worktree: `git worktree add worktrees/<feature>`
3. Plan → implement → test → docs → PR
4. GH issue milestone tracking

---

## References

- `.ai/project-index.yml` — complete file map
- `specs/docs/approvedPlans/` — all approved plans
- `docs/features/FEATURE-*.md` — public feature docs
- `.ai/rules/` — enforcement rules
- GitHub issues — backlog + milestones
