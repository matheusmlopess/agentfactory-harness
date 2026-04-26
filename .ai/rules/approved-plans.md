# Rule: Approved Plan Archive
<!-- version: 1.0.0 -->

Every approved plan MUST be saved to `specs/docs/approvedPlans/` before any
implementation begins.

## When to save

Immediately after the user approves a plan (ExitPlanMode confirmation, or explicit
"yes / go / do it" after a design proposal).

## File naming

```
specs/docs/approvedPlans/<YYYY-MM-DD>-<slug>.md
```

Examples:
- `2026-04-26-wave-0-scaffold.md`
- `2026-04-26-itui-mouse-system.md`
- `2026-04-26-pty-panel.md`

## File format

```markdown
# Plan: <title>
<!-- version: 1.0.0 -->
<!-- approved: <YYYY-MM-DD> -->

## Context
<why this change is being made>

## Scope
<what files / modules are touched>

## Implementation notes
<key decisions, constraints, approach>

## Verification
<how to test / confirm it works>
```

## Why

Creates a permanent record of what was decided and why. Future sessions can read
`specs/docs/approvedPlans/` to understand the history of every feature decision
without digging through git history.

## Enforcement

Before writing any implementation code, check: has this plan been saved to
`specs/docs/approvedPlans/`? If not, save it first.
