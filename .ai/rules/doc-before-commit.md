# Rule: Documentation Before Commit
<!-- version: 1.3.0 -->

Every implemented and tested feature MUST have a detailed feature document written
**before** the commit, **before** the PR, and **before** the milestone entry.

## Order of operations (strict)

```
implement → test → document → commit → PR → milestone
                      ↑
                 THIS rule
```

Never commit untested code. Never commit undocumented features.

## When this applies

- A plan has been fully implemented and all tests pass
- A standalone feature or fix is complete
- Any wave or sub-wave reaches a working state

## Where the doc goes

```
docs/features/FEATURE-<SLUG>.md
```

Examples:
- `docs/features/FEATURE-WAVE-0-SCAFFOLD.md`
- `docs/features/FEATURE-ITUI-CANVAS.md`
- `docs/features/FEATURE-PTY-PANEL.md`
- `docs/features/FEATURE-WAVE-3-DAG-ORCHESTRATION.md`

> **Legacy docs** in `docs/FEATURE-*.md` (Waves 0–2) are grandfathered.
> All new feature docs MUST go in `docs/features/`.

## Required doc sections

```markdown
# Feature: <Title>
<!-- version: 1.0.0 -->

## What it does
<1-3 sentences. What problem does this solve?>

## Architecture
<Box-drawing diagram of key files, classes, and data flow. See diagram requirements below.>

## How it works
<Detailed walkthrough of the implementation. Non-obvious decisions explained.>

## Usage
<Terminal-friendly fenced code blocks showing the feature in use. See workflow requirements below.>

## Test coverage
<What is tested, how to run, what is explicitly NOT tested yet.>

## Known limitations
<Edge cases, missing pieces, follow-up issues.>
```

---

## Diagram, Legend, and Scenario Requirements

### 1 — Box-drawing ASCII diagrams

Every architecture and data-flow diagram MUST use box-drawing characters.
Inline prose descriptions of data flow are **not** sufficient — draw it.

Preferred characters:
```
╔ ╗ ╚ ╝ ═ ║ ╠ ╣ ╦ ╩ ╬   double-line boxes (top-level component boundaries)
┌ ┐ └ ┘ ─ │ ├ ┤ ┬ ┴ ┼   single-line boxes (internal structure, sub-components)
╭ ╮ ╰ ╯               rounded corners (state nodes, flow paths)
→ ← ↑ ↓ ▶ ◀ ► ▲ ▼     directional arrows
○ ●                   ports (output / input)
```

Example — component data flow:

```
┌───────────────────────────────────────────────────────────────┐
│                          App.start()                          │
│  ┌──────────────┐  SIGWINCH  ┌───────────────────────────┐   │
│  │  stdin raw   │ ──────────► │     computeLayout()       │   │
│  └──────┬───────┘            └────────────┬──────────────┘   │
│         │ KeyEvent / MouseEvent            │ PanelLayout       │
│         ▼                                 ▼                   │
│  ┌──────────────┐            ┌───────────────────────────┐   │
│  │  InputRouter │            │  CellBuffer.diff() flush  │   │
│  └──────────────┘            └───────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

### 2 — Legend table

Every diagram section MUST have a legend table immediately below it.
Every ASCII symbol used in that diagram MUST appear in the legend — no undefined characters.

Format:

| Symbol | Meaning |
|--------|---------|
| `╔═╗╚╝║` | Double-line box — top-level component boundary |
| `┌─┐└┘│` | Single-line box — internal detail or sub-component |
| `►` | Data or control flow direction |
| `○` | Output port (idle, ready to wire) |
| `●` | Input port (active drop target) |

### 3 — Terminal-friendly example workflows

Every workflow example MUST be in a fenced code block with a language tag.
It MUST be copy-pasteable and runnable exactly as written.
Use `$` prefix for shell prompts; no prefix for program output.

Example:

```bash
# Launch factory TUI
$ factory

# Run health check
$ factory doctor

# Expected output:
  ✓  Node.js ≥ 20       v22.1.0
  ✓  ANTHROPIC_API_KEY  set
  ✗  Token file         ~/.agentfactory/token not found
  ○  .ai/ harness       not present (optional)
  ✓  CLAUDE.md          present

  4/5 checks passed
```

### 4 — Scenario walkthroughs

Every distinct use case or state transition MUST have its own box-drawing
sequence or state diagram, followed immediately by a numbered step-by-step
explanation. Prose-only scenario descriptions are **not** accepted.

One scenario = one diagram + one numbered list.

Example — scenario: "User drags a block to a new position":

```
IDLE ──mousedown(header)──► DRAGGING ──mousemove──► DRAGGING ──mouseup──► IDLE
  │                              │                       │                   │
  │                              └── ghost renders at cursor − offset        │
  │                                                                          │
  └──────────────────────── block snaps to grid on release ──────────────────┘
```

| Symbol | Meaning |
|--------|---------|
| `──►` | State transition with named trigger |
| `└──` | Concurrent side effect during the transition |
| Snap | `Math.round(pos / GRID) * GRID` applied to col and row on mouseup |

1. User presses mouse button on a block's header row — `parseMouseEvent` emits `press`.
2. `OrchestrationCanvas.onMouse()` matches the cell to a block header; sets `dragState = { kind:'dragging', blockId, offsetCol, offsetRow }`.
3. Each subsequent `mousemove` event calls `renderGhost(buf, cursor − offset)` — a faded copy of the block at the live cursor position.
4. On `mouseup`, final position is snapped: `{ col: Math.round(...), row: Math.round(...) }`.
5. The block's `col`/`row` fields are updated in `CanvasState.blocks`; `dragState` returns to `{ kind:'idle' }`.
6. `render()` is called once — ghost disappears, block settles at new position.

---

## Why

Feature docs serve three purposes:
1. **Future sessions**: A new Claude session can read `docs/` and understand the
   existing system without re-exploring source code.
2. **Contributors**: Clear reference for anyone joining the project.
3. **Design pressure**: Writing the doc before the PR often reveals gaps or unclear
   decisions that should be resolved before merge.

## Enforcement

Before running `git commit` on a feature branch:
1. Check: does `docs/features/FEATURE-<SLUG>.md` exist?
2. Check: does it have **all six required sections** (What it does, Architecture, How it works, Usage, Test coverage, Known limitations)?
3. Check: does every diagram have a legend table immediately below it?
4. Check: does every scenario have a box-drawing diagram + numbered step-by-step list?
5. Check: does every diagram symbol used appear in its legend? No undefined characters.
6. Check: does every usage example use a fenced code block with a language tag and `$` shell prompt prefix?
7. Update `.ai/project-index.yml`: add a row for every new file added in this commit; set `status` to `implemented`.
8. If this commit closes a wave: flip all that wave's rows from `planned` → `implemented` and bump `meta.wave`.
9. If any check fails — write the missing content first. Do not commit until all checks pass.
