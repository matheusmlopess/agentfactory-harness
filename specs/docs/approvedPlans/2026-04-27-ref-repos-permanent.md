# Plan: Permanent Reference Repos + Per-Repo index.yml + Enforcement
<!-- version: 1.1.0 -->

## Context

The `.refs/` directory previously held temporary research repos — the old Rule 9
permitted deleting them after research. This plan changes the model: reference repos
are now **permanent residents** that live in `.refs/` indefinitely, each with a
machine-readable `index.yml` describing every subfolder. A new `open-multi-agent`
repo was added. Every future planning session must read these index files before
designing an approach. No `src/` code was touched.

Approved: 2026-04-27

---

## Changes made

| # | Action | File |
|---|--------|------|
| 1 | Cloned `open-multi-agent` | `.refs/open-multi-agent/` |
| 2 | Wrote `index.yml` (every subfolder) | `.refs/anthropics-claude-code/index.yml` |
| 2 | Wrote `index.yml` (every subfolder) | `.refs/claude-code-harness/index.yml` |
| 2 | Wrote `index.yml` (every subfolder) | `.refs/claw-code/index.yml` |
| 2 | Wrote `index.yml` (every subfolder) | `.refs/openclaude/index.yml` |
| 2 | Wrote `index.yml` (every subfolder) | `.refs/open-multi-agent/index.yml` |
| 3 | Rewrote reference-repos rule | `.ai/rules/reference-repos.md` v2.0.0 |
| 4 | Expanded Rule 9 + version bump | `.ai/adapters/claude/brief.md` v1.5.0 |
| 5 | Added Reference Repos bullet + version bump | `.ai/AgentFactory.md` v1.2.0 |

---

## Key decisions

- **Permanent model**: repos stay in `.refs/` indefinitely — the library only grows.
- **Every subfolder**: index.yml describes all nested directories, not just top-level,
  for maximum scan efficiency during planning.
- **Active research base**: tool calls (Read, grep) may access `.refs/` files directly
  during planning — not just prose summaries.
- **Citation rule**: plan docs must cite `<repo>/<path>:<line>` for every borrowed
  pattern, enabling exact traceability without copying code.
- **Before-every-plan enforcement**: Rule 9 and AgentFactory.md now explicitly require
  reading all index files at the start of each planning session.
