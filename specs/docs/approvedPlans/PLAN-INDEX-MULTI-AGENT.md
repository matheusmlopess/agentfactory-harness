# Multi-Agent Orchestration — Spec Index (Wave 6)

<!-- version: 1.0.0 -->
<!-- classification: PLAN -->
<!-- date: 2026-06-17 -->
<!-- last-updated: 2026-06-17 -->

These 13 specs decompose the multi-agent orchestration design into self-contained,
spec-driven implementation units. Build in dependency order. See the master plan
(`check-on-ref-repos-lazy-pumpkin.md`, PART II) for the architecture review that produced
PLAN-00 (kernel) and PLAN-11 (coordinator) and resolved the 15 integration flaws.

| # | Spec | Depends on | Wave |
|---|---|---|---|
| **CORE** | [PLAN-CORE-INTEGRATION-SEAM](PLAN-CORE-INTEGRATION-SEAM.md) | — | **6A (FIRST)** |
| 00 | [PLAN-00-ORCHESTRATION-KERNEL](PLAN-00-ORCHESTRATION-KERNEL.md) | CORE, 01 | 6A |
| 01 | [PLAN-01-AGENT-DEFINITION-SYSTEM](PLAN-01-AGENT-DEFINITION-SYSTEM.md) | — | 6A |
| 02 | [PLAN-02-HANDOFF-CHAIN](PLAN-02-HANDOFF-CHAIN.md) | CORE, 01 | 6A |
| 03 | [PLAN-03-CROSS-PROVIDER-LLM](PLAN-03-CROSS-PROVIDER-LLM.md) | CORE, 02 | 6A |
| 04 | [PLAN-04-MESSAGE-BUS](PLAN-04-MESSAGE-BUS.md) | CORE, 01 | 6A |
| 05 | [PLAN-05-SHARED-MEMORY](PLAN-05-SHARED-MEMORY.md) | CORE, 01 | 6A |
| 06 | [PLAN-06-LOGIC-PORTS](PLAN-06-LOGIC-PORTS.md) | 00, 01 | 6B |
| 07 | [PLAN-07-AGENT-ASK](PLAN-07-AGENT-ASK.md) | CORE, 00, 01, 04 | 6B |
| 08 | [PLAN-08-TEAM-EXECUTOR](PLAN-08-TEAM-EXECUTOR.md) | CORE, 00, 01–05 | 6B |
| 09 | [PLAN-09-CLI](PLAN-09-CLI.md) | 08, 11 | 6C |
| 10 | [PLAN-10-TUI-MULTI-AGENT](PLAN-10-TUI-MULTI-AGENT.md) | 06, 07, 08 | 6C |
| 11 | [PLAN-11-COORDINATOR](PLAN-11-COORDINATOR.md) | CORE, 00, 01, 08 | 6B |
| 12 | [PLAN-12-TIERED-MEMORY](PLAN-12-TIERED-MEMORY.md) | CORE, 01, 05 | 6A |
| **13** | [PLAN-13-ORCHESTRATION-STUDIO](PLAN-13-ORCHESTRATION-STUDIO.md) | 01, 06, 10 | 6C |

> **PLAN-CORE is the hard prerequisite** (master plan PART III): it builds the missing
> `buildTool` / `ToolUseContext` / `runAgentLoop` / context-injection plumbing that the
> feature specs assume. Nothing else compiles without it.

## Build order

```
Wave 6A: CORE → 01 → {00, 02, 04, 05, 12} → 03
Wave 6B: 08 → {06, 07, 11}
Wave 6C: 09, 10, 13
```

**PLAN-13 (Visual Orchestration Studio)** is the n8n-style *authoring* canvas — the design-time
twin of PLAN-10's runtime monitor. It operationalizes the currently-superficial Wave-2/5 canvas
(which can only drag rectangles and draw lines): adds a toolbox, a node-defining inspector,
typed handoff/dependency connectors, logic-port nodes, and **round-trip `af-team.json`
serialization** so a designed team can actually be saved and run.

## Implementation-readiness (PART III expansion)

Every spec now carries: **§ Codebase Reality** (assumed symbol → real symbol → fix),
**§ Contracts** (IMPORTS/EXPORTS), full method bodies (no placeholders), helper definitions,
≥1 cross-spec integration test, and a Definition-of-Done checklist.

## Per-spec implementation prompt

```
Implement <PLAN-NN> for agentfactory-harness. Read specs/docs/approvedPlans/<PLAN-NN>.md.
Implement exactly what the spec says — no extra features. TypeScript strict, no `any`,
explicit return types. Run `npm test`; ≥80% coverage on new logic.
```

Estimated total: ~25.5 developer-days.
