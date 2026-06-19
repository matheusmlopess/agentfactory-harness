<!-- version: 1.0.0 -->
<!-- classification: SUMMARY -->
<!-- date: 2026-06-19 -->
<!-- last-updated: 2026-06-19 -->
<!-- status: ACTIVE -->

# PLANS/ — Document Plans (pending approval)

Spec-driven implementation plans (`PLAN-*`) authored from studies/sessions. These are **document
plans pending feature-dev approval** — on approval a plan is promoted to
`specs/docs/approvedPlans/` and renamed to the dated CLI format.

## Summary

The current set is the **multi-agent orchestration** spec suite. Build in dependency order; the
detailed index (build order + dependency graph + per-spec implementation prompt) lives in
[`PLAN-INDEX-MULTI-AGENT.md`](PLAN-INDEX-MULTI-AGENT.md) · [[PLAN-INDEX-MULTI-AGENT]].

## Build order (linear)

0. [`PLAN-CORE-INTEGRATION-SEAM.md`](PLAN-CORE-INTEGRATION-SEAM.md) · [[PLAN-CORE-INTEGRATION-SEAM]] — prerequisite: buildTool, ToolUseContext, runAgentLoop, provider widening.
1. [`PLAN-01-AGENT-DEFINITION-SYSTEM.md`](PLAN-01-AGENT-DEFINITION-SYSTEM.md) · [[PLAN-01-AGENT-DEFINITION-SYSTEM]] — TeamSchema, normalize (handoff→edge), roles/skills.
2. [`PLAN-00-ORCHESTRATION-KERNEL.md`](PLAN-00-ORCHESTRATION-KERNEL.md) · [[PLAN-00-ORCHESTRATION-KERNEL]] — context, tri-state gate, abort registry, events.
3. [`PLAN-02-HANDOFF-CHAIN.md`](PLAN-02-HANDOFF-CHAIN.md) · [[PLAN-02-HANDOFF-CHAIN]] — HandoffPackage + payload modes.
4. [`PLAN-03-CROSS-PROVIDER-LLM.md`](PLAN-03-CROSS-PROVIDER-LLM.md) · [[PLAN-03-CROSS-PROVIDER-LLM]] — OpenAICompatAdapter, serializeHandoff.
5. [`PLAN-04-MESSAGE-BUS.md`](PLAN-04-MESSAGE-BUS.md) · [[PLAN-04-MESSAGE-BUS]] — pub/sub + auto-delivery.
6. [`PLAN-05-SHARED-MEMORY.md`](PLAN-05-SHARED-MEMORY.md) · [[PLAN-05-SHARED-MEMORY]] — runtime Layer-1 KV.
7. [`PLAN-08-TEAM-EXECUTOR.md`](PLAN-08-TEAM-EXECUTOR.md) · [[PLAN-08-TEAM-EXECUTOR]] — settlement loop, pool, scheduler.
8. [`PLAN-06-LOGIC-PORTS.md`](PLAN-06-LOGIC-PORTS.md) · [[PLAN-06-LOGIC-PORTS]] — AND/OR/XOR/NAND gates + canvas diamonds.
9. [`PLAN-07-AGENT-ASK.md`](PLAN-07-AGENT-ASK.md) · [[PLAN-07-AGENT-ASK]] — AskBroker + slot-releasing pause.
10. [`PLAN-11-COORDINATOR.md`](PLAN-11-COORDINATOR.md) · [[PLAN-11-COORDINATOR]] — goal→task decomposition.
11. [`PLAN-12-TIERED-MEMORY.md`](PLAN-12-TIERED-MEMORY.md) · [[PLAN-12-TIERED-MEMORY]] — project/user/auto tiered memory.
12. [`PLAN-09-CLI.md`](PLAN-09-CLI.md) · [[PLAN-09-CLI]] — `factory agent` / `orchestrate`.
13. [`PLAN-10-TUI-MULTI-AGENT.md`](PLAN-10-TUI-MULTI-AGENT.md) · [[PLAN-10-TUI-MULTI-AGENT]] — runtime dashboard.
14. [`PLAN-13-ORCHESTRATION-STUDIO.md`](PLAN-13-ORCHESTRATION-STUDIO.md) · [[PLAN-13-ORCHESTRATION-STUDIO]] — n8n-style visual builder.

→ Full index: [`PLAN-INDEX-MULTI-AGENT.md`](PLAN-INDEX-MULTI-AGENT.md) · [[PLAN-INDEX-MULTI-AGENT]]

## Lifecycle

```
docs/PLANS/PLAN-NN-*.md  ──(approved in a feature-dev session)──►  specs/docs/approvedPlans/<YYYY-MM-DD>-<name>.md
   (pending)                                                          (final, dated CLI format)
```

## Reference

Glossary: [`../documentation/GLOSSARY.md`](../documentation/GLOSSARY.md) · Workflow: [`../reviews/REVIEW-DOCUMENTATION-WORKFLOW-2026-06-18.md`](../reviews/REVIEW-DOCUMENTATION-WORKFLOW-2026-06-18.md)
