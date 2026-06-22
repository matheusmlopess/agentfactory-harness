<!-- version: 1.0.0 -->
<!-- classification: SUMMARY -->
<!-- date: 2026-06-19 -->
<!-- last-updated: 2026-06-19 -->
<!-- status: ACTIVE -->

# Documentation — agentfactory-harness

Top-level map of all project documentation. Each category folder has its own master `README.md`
that lists its docs linearly; this page links them together.

## Summary

`factory` (agentfactory-harness) is a full-screen TUI orchestration shell for AI agents. The
docs are organized by **type** (see the taxonomy). Start with the **DDD reference** for design,
the **features** for how things work, and the **glossary** for term lookups.

## Category index

| Folder | What's inside | Master |
|---|---|---|
| [`documentation/`](documentation/README.md) | The doc system: taxonomy, templates, quick-start, registry, **glossary** | [README](documentation/README.md) |
| [`ddd/`](ddd/README.md) | Design-Driven Development reference (architecture, rendering, panels, journeys, gaps) | [README](ddd/README.md) · [INDEX](ddd/INDEX.md) |
| [`features/`](features/README.md) | Feature operational guides (per wave + subsystems) | [README](features/README.md) |
| [`testing/`](testing/README.md) | End-to-end test procedures | [README](testing/README.md) |
| [`reviews/`](reviews/README.md) | Design, gaps, analysis, security & documentation reviews | [README](reviews/README.md) |
| [`changes/`](changes/README.md) | Before/after change summaries | [README](changes/README.md) |
| [`PLANS/`](PLANS/README.md) | Document plans (`PLAN-*`) pending approval | [README](PLANS/README.md) · [INDEX](PLANS/PLAN-INDEX-MULTI-AGENT.md) |
| `assets/` | Images | — |

Roadmap docs live at the docs root: [`WAVE-PLAN.md`](WAVE-PLAN.md) · [`FUTURE-WORK.md`](FUTURE-WORK.md).

## Reference

- **Glossary** (term/acronym lookups): [`documentation/GLOSSARY.md`](documentation/GLOSSARY.md)
- **Registry** (index of every doc): [`documentation/DOCUMENTATION-REGISTRY.md`](documentation/DOCUMENTATION-REGISTRY.md)
- **How to add/update docs**: [`documentation/DOCUMENTATION-QUICK-START.md`](documentation/DOCUMENTATION-QUICK-START.md)

## Plan buckets (don't mix)

- `docs/PLANS/` — **document plans** (`PLAN-*`), pending feature-dev approval.
- `specs/docs/approvedPlans/` — **CLI-approved plans**, dated `YYYY-MM-DD-<name>.md`.

*See* [`reviews/REVIEW-DOCUMENTATION-WORKFLOW-2026-06-18.md`](reviews/REVIEW-DOCUMENTATION-WORKFLOW-2026-06-18.md) for the full workflow.
