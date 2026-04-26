# AgentFactory Intelligence Brief — Claude Code (agentfactory-harness)
<!-- version: 1.3.0 -->

## Harness

```
  Harness root : .ai/
  This adapter : claude
  Recompile    : agentfactory-gen brief
```

Shared context: `.ai/AgentFactory.md` — read this for the full project overview.

## Project Context

**agentfactory-harness** builds the `factory` CLI — a TypeScript full-screen TUI
with an ITUI (Interactive TUI) mouse canvas for agent orchestration. Raw ANSI
cell-buffer renderer, node-pty terminal embed, Claude API loop, af-plan.json DAG format.

Tech stack: TypeScript · tsup · tsx · commander · @anthropic-ai/sdk · node-pty · zod · vitest

## Governance Rules (ENFORCED)

### Rule 1 — Approved Plan Archive
Every approved plan MUST be saved to `specs/docs/approvedPlans/<slug>.md` before
implementation begins. This is a documentation companion — it creates a permanent
record of what was decided and why. Format: date prefix + descriptive slug.
Example: `specs/docs/approvedPlans/2026-04-26-wave-0-scaffold.md`

### Rule 2 — Worktree-First Implementation
Every feature or modification MUST be implemented in a git worktree branched from
`main`. Before creating a new worktree, ALWAYS ask:

  "Is there already a branch or worktree in progress for this work?
   Should I continue on the current branch instead of creating a new worktree?"

Only skip the question if the user has explicitly stated which branch to use.
Worktree location: `../agentfactory-harness-wt/<branch-name>/`

### Rule 3 — Documentation Before Commit
Every implemented and tested feature MUST have a detailed `docs/FEATURE-<SLUG>.md`
written **before** the commit, before the PR, and before the milestone entry.

Order of operations (strict):
```
implement → test → document → commit → PR → milestone
```

Required sections: What it does · Architecture · How it works · Usage ·
Test coverage · Known limitations.

Every doc MUST include:
- **Box-drawing ASCII diagrams** for every architecture/data-flow view
- **Legend table** below each diagram defining every symbol used
- **Terminal-friendly fenced code blocks** for every workflow example (copy-pasteable)
- **Scenario walkthroughs**: one box-drawing diagram + numbered steps per distinct use case

See `.ai/rules/doc-before-commit.md` for full spec.

### Rule 4 — Version Markers
Every `.md` file MUST have `<!-- version: x.y.z -->` on line 2. Bump minor on
content changes, patch on typo/formatting fixes.

### Rule 5 — TypeScript Strictness
- `strict: true` in tsconfig — no exceptions
- No `any` types — use `unknown` + type guards
- Explicit return types on all exported functions
- Prefer `const` over `let`

### Rule 6 — Secrets
Never log, print, or commit API keys, tokens, or credentials. Token path:
`~/.agentfactory/token` — read at runtime, never stored in code.

### Rule 7 — Test Coverage
New logic requires 80%+ vitest coverage. Test files co-located: `src/foo/bar.test.ts`

### Rule 8 — Search Index First
Before using `find`/`grep` or walking `src/`, read `.ai/project-index.yml`.
It lists every file in the repo with purpose and key exports, organized by layer.
Only search beyond the index when a file is missing from it — then add a row after.

## Key Files

| File | Purpose |
|------|---------|
| `.ai/project-index.yml` | Complete file map — read before any search |
| `src/tui/renderer/cell-buffer.ts` | Core renderer — Cell[][], diff, flush |
| `src/tui/renderer/ansi.ts` | ANSI sequence builders |
| `src/tui/input/mouse.ts` | SGR mouse event parser |
| `src/tui/panels/OrchestrationCanvas.ts` | ITUI drag-drop canvas |
| `src/core/agent-loop.ts` | Claude streaming loop |
| `src/orchestration/schema.ts` | af-plan.json Zod schema |
| `specs/docs/approvedPlans/` | Approved plan archive |

## Slash Commands

| Command | What it does |
|---------|-------------|
| `/run <plan>` | Execute af-plan.json → live canvas |
| `/spawn <agent>` | Sub-session for an agent |
| `/doctor` | Health check |
| `/plan new` | Interactive plan wizard |
| `/import <slug>` | Pull from registry |
| `/publish <name>` | Wrap + upload |
