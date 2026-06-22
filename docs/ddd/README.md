<!-- version: 1.0.0 -->
<!-- classification: SUMMARY -->
<!-- date: 2026-06-19 -->
<!-- last-updated: 2026-06-19 -->
<!-- status: ACTIVE -->

# ddd/ — Design-Driven Development Reference

> 📖 **Full compendium:** [MEMORIAL.md](MEMORIAL.md) · [[MEMORIAL]] — every doc in this folder in one date-ordered descriptive document (index + glossary).

The current-state design reference for `factory` (Waves 0–5), written to feed into Claude Design.
Read [`MENTAL-MAP.md`](MENTAL-MAP.md) · [[MENTAL-MAP]] first; the detailed table of contents + aggregated open
questions are in [`INDEX.md`](INDEX.md) · [[INDEX]].

## Summary

A structured design reference: orientation skeleton, architecture, rendering, input/focus,
panels, core data, orchestration, user journeys, design language, gaps, optimizations, and a
lightweight feature-isolation proposal.

## Contents (linear)

- [`MENTAL-MAP.md`](MENTAL-MAP.md) · [[MENTAL-MAP]] — orientation skeleton (read first): file map, where-to-look, invariants.
- [`INDEX.md`](INDEX.md) · [[INDEX]] — table of contents + how-to-use + aggregated open design questions.
1. [`00-overview.md`](00-overview.md) · [[00-overview]] — vision, ITUI concept, run model.
2. [`01-architecture.md`](01-architecture.md) · [[01-architecture]] — layers, module map, tech stack.
3. [`02-rendering.md`](02-rendering.md) · [[02-rendering]] — cell-buffer, diff, layout, theme, render loop.
4. [`03-input-focus.md`](03-input-focus.md) · [[03-input-focus]] — keyboard/mouse parse, router, focus, terminal bypass.
5. [`04-panels.md`](04-panels.md) · [[04-panels]] — every panel + widget: state, layout, interactions.
6. [`05-core-data.md`](05-core-data.md) · [[05-core-data]] — agent loop, session, tools, LLM, config, logger, rollout.
7. [`06-orchestration.md`](06-orchestration.md) · [[06-orchestration]] — af-plan.json schema, executor, graph, planner.
8. [`07-user-journeys.md`](07-user-journeys.md) · [[07-user-journeys]] — 9 journeys + sequence diagrams + expected behaviours.
9. [`08-design-language.md`](08-design-language.md) · [[08-design-language]] — palette, iconography, modals, cell constraints.
10. [`09-gaps.md`](09-gaps.md) · [[09-gaps]] — inconsistencies, accessibility, responsiveness.
11. [`10-optimizations.md`](10-optimizations.md) · [[10-optimizations]] — improvements + what can be simplified.
12. [`11-feature-isolation.md`](11-feature-isolation.md) · [[11-feature-isolation]] — lightweight Feature-interface proposal.

## Reference

Glossary: [`../documentation/GLOSSARY.md`](../documentation/GLOSSARY.md)

> Note: this set keeps its numbered structure (exempt from `TYPE-NAME-DATE` naming) as a
> cohesive multi-file reference.
