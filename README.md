# agentfactory-harness
<!-- version: 1.0.0 -->

`factory` — an ITUI (Interactive TUI) orchestration shell for AI agents.

## What is ITUI?

ITUI is a novel terminal interaction model: a full-screen TUI with **mouse drag-and-drop ASCII blocks** for building and executing agent orchestration plans visually, inside the terminal. No GUI required.

```
╔═════════════╗              ╔══════════════╗              ╔══════════╗
║  data-fetch ║              ║  transform   ║              ║   load   ║
║  v1.2.0     ║              ║  v1.0.0      ║              ║  v1.1.0  ║
║  ✓ done     ║              ║  ⏳ running  ║             ║  ○ idle  ║
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
| 1 | ✓ done | Claude session, tools, hooks |
| 2 | ✓ done | ITUI mouse canvas, drag-drop |
| 3 | ✓ done | DAG executor, /run |
| 3.5 | ✓ done | Multi-LLM provider layer (Anthropic + OpenAI) |
| 4 | ✓ done | PTY terminal panel, VTScreen ANSI, mouse navigation (PR #15) |
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

## Registered Agents
<!-- @agent-registry:start -->
- **security-review**: Produces dated REVIEW-SECURITY-ARCHITECTURE-YYYY-MM-DD.md reports: component matrix, Mermaid diagrams, SEV-classified security findings, design gaps, and a prioritised recommendations table. (See: `.ai/agents/security-review/docs/CLAUDE.md`)
<!-- @agent-registry:end -->

## Available Skills
<!-- @skills-registry:start -->
- **security-review**: Full security and architecture review of a repo: component matrix, Mermaid diagrams, SEV-classified findings, design gaps, recommendations table. (See: `.ai/skills/security-review/SKILL.md`)
<!-- @skills-registry:end -->
