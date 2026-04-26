# Rule: Worktree-First Implementation
<!-- version: 1.0.0 -->

Every feature or modification MUST be implemented in a dedicated git worktree
branched from `main`. Never implement features directly on `main`.

## Before creating a worktree — always ask

Before creating a new worktree, ALWAYS ask the user:

  "There is already work in progress — should I continue on the current branch
   `<branch>` instead of creating a new worktree?"

Skip the question only if:
- The user has explicitly named the branch in their message
- The user said "use the current branch" or equivalent

## Creating a worktree

```bash
# Branch name convention: feature/<short-desc> or fix/<short-desc>
git worktree add ../agentfactory-harness-wt/<branch-name> -b <branch-name> main
```

Worktree location: `../agentfactory-harness-wt/<branch-name>/`

## Worktree lifecycle

1. Plan approved → save to `specs/docs/approvedPlans/`
2. Ask about existing branch (see above)
3. If new worktree: `git worktree add ...`
4. Implement in worktree
5. PR → merge to `main`
6. `git worktree remove ../agentfactory-harness-wt/<branch-name>`

## Why

Keeps `main` always in a working state. Enables parallel work on multiple features
without interference. Matches the AgentFactory contribution model (feature branch
per issue).

## Enforcement

Never start implementing without confirming the worktree / branch context first.
