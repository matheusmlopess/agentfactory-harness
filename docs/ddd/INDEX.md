# DDD — Design-Driven Development Reference for `factory`

<!-- version: 1.0.0 -->
<!-- classification: DESIGN -->
<!-- date: 2026-06-18 -->
<!-- last-updated: 2026-06-18 -->

A complete design reference for the `factory` (agentfactory-harness) terminal app, written to
feed into **Claude Design** for UI/UX iteration. Describes the **current implemented** app
(Waves 0–5); planned work is referenced only in gaps/optimizations.

## How to use with Claude Design

1. Start with **[MENTAL-MAP.md](MENTAL-MAP.md)** for fast orientation.
2. Read sections **00–08** for the current state (what exists, how it behaves).
3. Use **09–11** for the change agenda: gaps, optimizations, and how to isolate features so
   each can be redesigned/worked independently.
4. Answer the **Open Design Questions** at the end of each file (aggregated below). Feed your
   answers back as updates to the corresponding section.

## Table of contents

| # | File | Covers |
|---|---|---|
| — | [MENTAL-MAP.md](MENTAL-MAP.md) | Orientation skeleton — read first |
| 00 | [00-overview.md](00-overview.md) | Vision, ITUI concept, product framing, run model |
| 01 | [01-architecture.md](01-architecture.md) | Layers, module map, tech stack, component diagram |
| 02 | [02-rendering.md](02-rendering.md) | Cell-buffer, diff, layout, theme, render loop |
| 03 | [03-input-focus.md](03-input-focus.md) | Keyboard/mouse parse, router, focus, terminal bypass |
| 04 | [04-panels.md](04-panels.md) | Every panel + widget: state, layout, interactions |
| 05 | [05-core-data.md](05-core-data.md) | Agent loop, session, tools, LLM, config, logger, rollout |
| 06 | [06-orchestration.md](06-orchestration.md) | af-plan.json schema, executor, graph, planner |
| 07 | [07-user-journeys.md](07-user-journeys.md) | 9 journeys + sequence diagrams + expected behaviours |
| 08 | [08-design-language.md](08-design-language.md) | Palette semantics, iconography, modals, cell constraints |
| 09 | [09-gaps.md](09-gaps.md) | Inconsistencies, accessibility, responsiveness |
| 10 | [10-optimizations.md](10-optimizations.md) | Improvements + what can be simplified |
| 11 | [11-feature-isolation.md](11-feature-isolation.md) | Lightweight Feature-interface proposal |
| — | [../testing/TESTING-FACTORY-E2E-2026-06-18.md](../testing/TESTING-FACTORY-E2E-2026-06-18.md) | End-to-end test procedures (preconditions, steps, expected, failure indicators) |
| — | [../reviews/REVIEW-CURRENT-STATE-2026-06-18.md](../reviews/REVIEW-CURRENT-STATE-2026-06-18.md) | Consolidated implementation review (reasoning, assumptions, gaps/risks, enhancements, safeguards) |

## Aggregated Open Design Questions (decision checklist)

These are collected from each section. Answer them to drive the redesign.

- **Visual system (08):** Adopt semantic color tokens over raw 256 indices? Ship a high-contrast
  theme? Define a typography/emphasis scale (bold/dim/reverse usage rules)?
- **Status & affordance (08):** Is color-only status acceptable, or add shape/text redundancy
  for accessibility? Standardize one focus-ring affordance across panels?
- **Interaction consistency (09):** Unify scroll-wheel semantics (offset vs selection, ×1 vs ×3)?
  Standardize wrap-vs-clamp list navigation? Bring vim keys to all panels or none?
- **Overlays (10):** Consolidate the 3 duplicate modal implementations into one `Overlay` widget?
  What is the canonical modal geometry/behaviour?
- **Layout/responsiveness (09):** Support <80-column terminals? Make the 40/70 splits adjustable?
- **Canvas (04, 09):** Operationalize the authoring canvas now (see PLAN-13) or keep read-only?
- **Agents panel (04, 09):** Promote to a team dashboard (see PLAN-10) or keep the session list?
- **Feature isolation (11):** Keep panels class-based (`Panel`) or move to declarative descriptors
  (affects a future web renderer)? Adopt the `Feature` registry now or after the UI fixes?
- **Defaults (09):** Raise `DEFAULT_MAX_TOKENS` (2048) for agentic use? Single `VERSION` source?

## Conventions in this doc set

- Every file carries `<!-- version -->`, `<!-- classification -->`, `<!-- date -->`, and
  `<!-- last-updated -->` markers per `docs/DOCUMENTATION-TAXONOMY.md` (`date` is set once;
  only `last-updated` changes on edits).
- Mermaid diagrams use GitHub-safe patterns (no parentheses inside node labels).
- Facts cite the source file; `file:line` where precision matters.
- "Current state" is descriptive; "gaps/optimizations" are prescriptive and clearly separated.
