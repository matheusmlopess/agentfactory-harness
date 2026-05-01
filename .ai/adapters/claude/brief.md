# AgentFactory Intelligence Brief — Claude Code (agentfactory-harness)
<!-- version: 1.6.0 -->

## Harness

```
  Harness root : .ai/
  This adapter : claude
  Recompile    : agentfactory-gen brief
```

## Project Overview

**agentfactory-harness** (`factory` CLI) is a full-screen TypeScript TUI that acts as
an interactive orchestration shell for AI agents. It implements the **ITUI** concept —
an Interactive TUI with mouse drag-and-drop ASCII canvas for building and running
agent orchestration plans visually inside the terminal.

### Core concepts

- **ITUI Canvas**: drag-and-drop ASCII blocks (agent nodes) + wire connections
- **af-plan.json**: portable orchestration plan format (DAG of agent steps)
- **Three planes**: Agent (Claude loop) · Orchestration (DAG executor) · Registry
- **Raw ANSI renderer**: custom cell-buffer, no framework (Ink/blessed)
- **PTY embed**: real terminal panel via `node-pty`

### Repository

```
agentfactory-harness/
├── src/
│   ├── tui/renderer/      ← cell-buffer, ANSI, layout, theme
│   ├── tui/input/         ← keyboard, mouse (SGR), router
│   ├── tui/panels/        ← Session, OrchestrationCanvas, Terminal, Agents
│   ├── tui/widgets/       ← Block, Wire, ContextMenu, CommandPalette
│   ├── core/              ← agent-loop, tools, hooks, session
│   ├── orchestration/     ← schema (Zod), executor, planner, graph
│   ├── harness/           ← .ai/ reader, manifest, doctor
│   └── registry/          ← agentfactory.dev client, auth
├── specs/
│   └── docs/approvedPlans/  ← every approved plan stored here
└── .ai/                     ← this harness
```

## Project Index

`.ai/project-index.yml` — read this first when searching for any file or function.
Lists every file in the repo: path · purpose · key exports · wave · status.
Organized into 12 sections (TUI Renderer, Input, Panels, Widgets, Core, Orchestration,
Harness, Registry, CLI, Governance, Docs, Config). Jump directly to the relevant section
rather than walking the directory tree.

## Search Protocol

When searching for a file, function, or module:
1. Read `.ai/project-index.yml` — find the relevant section, locate the row
2. Found → read that file directly; no `find`/`grep` needed
3. Not found → either planned (check `status` column) or does not exist yet

---

### Wave plan

| Wave | Scope |
|------|-------|
| 0 | Scaffold: cell-buffer, ANSI, static layout, `factory doctor` |
| 1 | Session: Claude streaming loop, tools, hooks, slash commands |
| 2 | ITUI Canvas: mouse SGR, block drag, wire routing |
| 3 | Orchestration: DAG executor, live status, `/run` |
| 4 | PTY terminal panel |
| 5 | Registry + .ai/ harness integration |

## Behavior Rules

See `.ai/rules/` for all enforced rules. Summary:

### Rule 9 — Reference Repos (Permanent)
`.refs/` holds permanent reference repos — never delete them after research.
Each repo has `.refs/<name>/index.yml` describing every subfolder.

**Before starting any plan:** read every `.refs/*/index.yml` to survey available
reference material. Tool calls MAY read files directly inside `.refs/` repos during
research. When anything from a ref repo informs a decision, cite the repo-relative
file path and line (e.g. `open-multi-agent/src/task/index.ts:87`) in the plan doc.
See `.ai/rules/reference-repos.md` for the full contract.

- **Approved Plans**: Every feature starts with an approved plan. Plans are saved to
  `specs/docs/approvedPlans/` before implementation begins.
- **Worktrees**: Every approved plan is implemented in a new git worktree branched
  from `main`. Always ask if work is already in progress on a branch before creating
  a new worktree.
- **Version Markers**: Every `.md` file MUST carry `<!-- version: x.y.z -->`.
- **Branches**: feature branches follow `feature/<short-desc>` convention.
- **Secrets**: Never log, print, or commit API keys or tokens.
- **Coverage**: 80%+ test coverage for new logic (vitest).
- **TypeScript**: strict mode, no `any`, explicit return types on public functions.

## Registered Agents
<!-- @agent-registry:start -->
- **security-review**: Produces dated REVIEW-SECURITY-ARCHITECTURE-YYYY-MM-DD.md reports: component matrix, Mermaid diagrams, SEV-classified security findings, design gaps, and a prioritised recommendations table. (See: `.ai/agents/security-review/docs/CLAUDE.md`)
<!-- @agent-registry:end -->

## Available Skills
<!-- @skills-registry:start -->
- **security-review**: Full security and architecture review of a repo: component matrix, Mermaid diagrams, SEV-classified findings, design gaps, recommendations table. (See: `.ai/skills/security-review/SKILL.md`)
<!-- @skills-registry:end -->

## Commands

No commands registered.
