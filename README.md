# agentfactory-harness
<!-- version: 1.0.0 -->

`factory` — an ITUI (Interactive TUI) orchestration shell for AI agents.

## What is ITUI?

ITUI is a novel terminal interaction model: a full-screen TUI with **mouse drag-and-drop ASCII blocks** for building and executing agent orchestration plans visually, inside the terminal. No GUI required.

```
╔═════════════╗              ╔══════════════╗              ╔══════════╗
║  data-fetch ║              ║  transform   ║              ║   load   ║
║  v1.2.0     ║              ║  v1.0.0      ║              ║  v1.1.0  ║
║  ✓ done     ║              ║  ⏳ running  ║              ║  ○ idle  ║
╠═════════════╣              ╠══════════════╣              ╠══════════╣
║ ○───────────╫──────────────╫►●            ║──────────────╫►●        ║
╚═════════════╝              ╚══════════════╝              ╚══════════╝
```

Drag blocks · Draw wires · Right-click menus · Live execution status

## Install

```bash
npm install -g agentfactory-harness
factory doctor   # check environment
factory          # launch TUI
```

## Keyboard shortcuts (Wave 0)

| Key | Action |
|-----|--------|
| `Tab` | Cycle focused panel |
| `1`–`4` | Jump to tab |
| `Ctrl+Q` / `q` | Quit |

## Slash commands (Wave 1+)

| Command | Description |
|---------|-------------|
| `/run <plan>` | Execute an `af-plan.json` — renders live on canvas |
| `/spawn <agent>` | Open an agent sub-session |
| `/import <slug>` | Pull agent from registry |
| `/publish <name>` | Wrap + upload to registry |
| `/plan new` | Interactive orchestration plan wizard |
| `/doctor` | Environment health check |

## Architecture

```
factory
├── AGENT PLANE        Claude API loop · tools · hooks · slash commands
├── ORCHESTRATION      ITUI canvas · af-plan.json · DAG executor · live status
└── REGISTRY           agentfactory.dev · import / publish · auth
```

Raw ANSI cell-buffer renderer (no Ink, no blessed) · node-pty terminal embed · TypeScript strict mode

## Wave plan

| Wave | Status | Scope |
|------|--------|-------|
| 0 | ✓ done | Scaffold: renderer, layout, doctor |
| 1 | pending | Claude session, tools, hooks |
| 2 | pending | ITUI mouse canvas, drag-drop |
| 3 | pending | DAG executor, /run |
| 4 | pending | PTY terminal panel |
| 5 | pending | Registry integration |

## Governance

Every feature starts with an approved plan saved to `specs/docs/approvedPlans/`.
Every implementation runs in a dedicated git worktree branched from `main`.
See `.ai/rules/` for full enforcement rules.

## Relationship to AgentFactory

`agentfactory-harness` consumes the same `.ai/` harness convention and Portable Unit
format as [`agentfactory-gen`](https://github.com/matheusmlopess/AgentFactory).
Orchestration primitives proven here (`af-plan.json`, DAG executor) will be upstreamed
to `agentfactory-gen` as the #77 epic matures.
