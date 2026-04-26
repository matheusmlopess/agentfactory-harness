# AgentFactory Intelligence Brief — agentfactory-harness
<!-- version: 1.1.0 -->

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
