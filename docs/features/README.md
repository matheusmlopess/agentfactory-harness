<!-- version: 1.0.0 -->
<!-- classification: SUMMARY -->
<!-- date: 2026-06-19 -->
<!-- last-updated: 2026-06-19 -->
<!-- status: ACTIVE -->

# features/ — Feature Operational Guides

How each shipped feature works: architecture, workflows, configuration, interactions. Ordered by
wave, then cross-cutting subsystems.

## Summary

Each doc describes one implemented capability of `factory` (Waves 0–5) — what it does, how it's
built, and how to use it. For design rationale see [`../ddd/`](../ddd/README.md); for term
lookups see the [Glossary](../documentation/GLOSSARY.md).

## By wave

1. [`FEATURE-WAVE-0-SCAFFOLD-2026-04-26.md`](FEATURE-WAVE-0-SCAFFOLD-2026-04-26.md) — cell-buffer renderer, ANSI, layout, doctor.
2. [`FEATURE-WAVE-1-SESSION-2026-04-27.md`](FEATURE-WAVE-1-SESSION-2026-04-27.md) — streaming agent loop, tools, hooks, slash commands.
3. [`FEATURE-WAVE-2-ITUI-CANVAS-2026-04-27.md`](FEATURE-WAVE-2-ITUI-CANVAS-2026-04-27.md) — mouse input, draggable blocks, wire routing.
4. [`FEATURE-WAVE-3-DAG-ORCHESTRATION-2026-05-01.md`](FEATURE-WAVE-3-DAG-ORCHESTRATION-2026-05-01.md) — DAG executor, toposort, cascade-skip, `run`.
5. [`FEATURE-WAVE-4-TERMINAL-PANEL-2026-05-18.md`](FEATURE-WAVE-4-TERMINAL-PANEL-2026-05-18.md) — embedded PTY + VTScreen.
6. [`FEATURE-WAVE-5-REGISTRY-AUTH-2026-06-09.md`](FEATURE-WAVE-5-REGISTRY-AUTH-2026-06-09.md) — registry auth, device login, key import.

## Subsystems & cross-cutting

7. [`FEATURE-SYSTEM-ARCHITECTURE-v0.4.0-2026-05-18.md`](FEATURE-SYSTEM-ARCHITECTURE-v0.4.0-2026-05-18.md) — system architecture overview (Waves 0–3.5).
8. [`FEATURE-TOOLS-AND-TOKEN-FLOW-2026-06-01.md`](FEATURE-TOOLS-AND-TOKEN-FLOW-2026-06-01.md) — tool catalog, request anatomy, token costs.
9. [`FEATURE-LOGS-PANEL-2026-06-09.md`](FEATURE-LOGS-PANEL-2026-06-09.md) — live logs, metrics, AI insights.
10. [`FEATURE-LOGGER-2026-06-09.md`](FEATURE-LOGGER-2026-06-09.md) — logging system (levels, ring buffer, file).
11. [`FEATURE-PROJECT-INDEX-2026-04-26.md`](FEATURE-PROJECT-INDEX-2026-04-26.md) — the `.ai/project-index.yml` navigation aid.
12. [`FEATURE-AGENTFACTORY-SKILL-PIPELINE-2026-05-01.md`](FEATURE-AGENTFACTORY-SKILL-PIPELINE-2026-05-01.md) — agentfactory-gen skill creation pipeline + CLI gaps.

## Reference

Glossary: [`../documentation/GLOSSARY.md`](../documentation/GLOSSARY.md) · Registry: [`../documentation/DOCUMENTATION-REGISTRY.md`](../documentation/DOCUMENTATION-REGISTRY.md)
