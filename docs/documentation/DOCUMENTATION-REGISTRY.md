<!-- version: 1.3.0 -->
<!-- classification: REVIEW -->
<!-- review-type: DOCUMENTATION -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-07-07 -->
<!-- status: ACTIVE -->

# Documentation Registry

Complete index of all documentation organized by type, feature, and date.

**Use this registry to:**
- Find existing documentation before creating new docs
- Understand what's been documented
- See what's missing
- Track status of documentation
- Identify superseded or archived docs

---

## Quick Search by Type

| Type | Count | Latest | Status |
|------|-------|--------|--------|
| **FEATURE** | 6 | 2026-07-07 | ✅ Active |
| **TESTING** | 2 | 2026-06-18 | ✅ Active |
| **DESIGN** | 1 + DDD set (14) | 2026-06-18 | ✅ Active |
| **GAPS** | 0 | — | — |
| **ANALYSIS** | 1 | 2026-06-09 | ✅ Active |
| **CHANGE** | 1 | 2026-06-09 | ✅ Active |
| **STUDY** | 0 | — | — |
| **REVIEW** | 4 | 2026-06-18 | ✅ Active |
| **ARCHITECTURE** | 1 | 2026-04-27 | ✅ Active |
| **SUMMARY** | 1 | 2026-06-09 | ✅ Active |
| **PLAN** | 16 | 2026-06-17 | ✅ Active (PR #23) |

---

## Navigation & Reference

Each category folder has a master `README.md` (summary + linear linked index). The **Glossary**
is the centralized term/acronym lookup.

| Master | Folder |
|---|---|
| [docs/README.md](../README.md) | top-level map of all categories |
| [documentation/README.md](README.md) | the doc system (taxonomy, templates, quick-start, registry, glossary) |
| **[documentation/GLOSSARY.md](GLOSSARY.md)** | **Reference / Glossary** — acronyms + key terms |
| [ddd/README.md](../ddd/README.md) · [ddd/INDEX.md](../ddd/INDEX.md) | design reference |
| [features/README.md](../features/README.md) | feature guides |
| [testing/README.md](../testing/README.md) | test procedures |
| [reviews/README.md](../reviews/README.md) | design/gaps/analysis/review |
| [changes/README.md](../changes/README.md) | change summaries |
| [PLANS/README.md](../PLANS/README.md) · [PLANS/PLAN-INDEX-MULTI-AGENT.md](../PLANS/PLAN-INDEX-MULTI-AGENT.md) | document plans |

---

## Documentation by Type

### FEATURE Docs (Operational Guides)

| Doc | Date | Feature | Status | Purpose |
|-----|------|---------|--------|---------|
| FEATURE-UI-CONSOLIDATION-2026-07-07.md | 2026-07-07 | UI Consolidation | ✅ Active | ddd/09–11 implementation: Overlay/ListBehavior, theme tokens, InputController, keymap, a11y, size profiles, Feature registry |
| FEATURE-ORCHESTRATION-STUDIO-2026-07-07.md | 2026-07-07 | Orchestration Studio | ✅ Active | Standalone PLAN-13/PLAN-10: StudioModel, typed connectors, inspector, toolbox, team dashboard, NDJSON run |
| FEATURE-LOGS-PANEL-2026-06-09.md | 2026-06-09 | Logs Panel | ✅ Active | Live logging, metrics, auto-analysis operational guide |
| FEATURE-WAVE-5-REGISTRY-AUTH-2026-06-09.md | 2026-04-XX | Registry Auth | ✅ Active | Registry authentication & key management |
| FEATURE-WAVE-4-TERMINAL-PANEL-2026-05-18.md | 2026-04-XX | Terminal Panel | ✅ Active | Embedded PTY terminal usage |
| FEATURE-AGENTFACTORY-SKILL-PIPELINE-2026-05-01.md | 2026-04-XX | Skill Pipeline | ✅ Active | Agent skill execution pipeline |

---

### TESTING Docs (Test Procedures)

| Doc | Date | Feature | Status | Purpose |
|-----|------|---------|--------|---------|
| TESTING-LOGS-PANEL-2026-06-09.md | 2026-06-09 | Logs Panel | ✅ Active | 30+ test cases, procedures, failure checklist |
| testing/TESTING-FACTORY-E2E-2026-06-18.md | 2026-06-18 | factory (Waves 0–5) | ✅ Active | E2E test guide: 9 surfaces, preconditions/steps/expected/failure indicators |

---

### DESIGN Docs (Design Decisions & Rationale)

| Doc | Date | Feature | Status | Purpose |
|-----|------|---------|--------|---------|
| DESIGN-LOGS-PANEL-2026-06-09.md | 2026-06-09 | Logs Panel | ✅ Active | 6 design decisions, trade-offs, assumptions |
| docs/ddd/ (DDD reference set, 14 files) | 2026-06-18 | factory UI (Waves 0–5) | ✅ Active | Design-driven dev reference: MENTAL-MAP, INDEX, 00-overview…11-feature-isolation (architecture, rendering, input, panels, core, orchestration, journeys, design-language, gaps, optimizations, isolation) |

---

### GAPS Docs (Missing Features & Risks)

| Doc | Date | Feature | Status | Purpose |
|-----|------|---------|--------|---------|
| (None yet) | — | — | — | — |

**To Create:**
- GAPS-LOGS-PANEL-2026-06-09.md (6 identified gaps, prioritized)

---

### ANALYSIS Docs (Deep Dives)

| Doc | Date | Feature | Type | Status | Purpose |
|------|------|---------|------|--------|---------|
| ANALYSIS-DESIGN-LOGS-PANEL-2026-06-09.md | 2026-06-09 | Logs Panel | DESIGN | ✅ Active | Trade-off analysis, assumptions, gaps |

---

### CHANGE Docs (Code & Behavior Changes)

| Doc | Date | Feature | Status | Purpose |
|-----|------|---------|--------|---------|
| CHANGE-LOGS-PANEL-2026-06-09.md | 2026-06-09 | Logs Panel | ✅ Active | Before/after code, behavioral changes, performance |

---

### STUDY Docs (Research & Exploration)

| Doc | Date | Topic | Status | Purpose |
|-----|------|-------|--------|---------|
| (None yet) | — | — | — | — |

**Examples for future:**
- STUDY-LOGGING-STRATEGIES-YYYY-MM-DD.md
- STUDY-LLM-ANALYSIS-INTEGRATION-YYYY-MM-DD.md

---

### REVIEW Docs (Audits & Verification)

| Doc | Date | Type | Feature | Status | Purpose |
|-----|------|------|---------|--------|---------|
| REVIEW-DOCUMENTATION-LOGS-2026-06-09.md | 2026-06-09 | DOCUMENTATION | Logs Panel | ✅ Active | Documentation completeness audit |
| REVIEW-SECURITY-ARCHITECTURE-2026-04-27.md | 2026-04-27 | SECURITY | Overall | ✅ Active | Security & architecture review |
| REVIEW-CURRENT-STATE-2026-06-18.md | 2026-06-18 | IMPLEMENTATION | factory (Waves 0–5) | ✅ Active | Consolidated review: reasoning, assumptions, gaps/risks, enhancements, safeguards |
| REVIEW-DOCUMENTATION-WORKFLOW-2026-06-18.md | 2026-06-18 | DOCUMENTATION | Docs & plan workflow | ✅ Active | How the taxonomy + two plan buckets work, every scenario, tree diagrams |

---

### ARCHITECTURE Docs (System Design)

| Doc | Date | System | Version | Status | Purpose |
|-----|------|--------|---------|--------|---------|
| docs/features/FEATURE-SYSTEM-ARCHITECTURE-v0.4.0-2026-05-18.md | 2026-04-27 | Logs Panel | v0.4.0 | ✅ Active | System architecture overview |

---

### SUMMARY Docs (High-Level Overviews)

| Doc | Date | Feature | Status | Purpose |
|-----|------|---------|--------|---------|
| IMPLEMENTATION-COMPLETE-LOGS-PANEL-2026-06-09.md | 2026-06-09 | Logs Panel | ✅ Active | Implementation status, verification, next steps |

---

### PLAN Docs (Spec-Driven Implementation Plans)

Location: `docs/PLANS/`. Set introduced by **PR #23** (multi-agent orchestration).

| Doc | Date | Feature | Status | Purpose |
|-----|------|---------|--------|---------|
| PLAN-INDEX-MULTI-AGENT.md | 2026-06-17 | Multi-Agent | ✅ Active | Index + build order + dependency graph |
| PLAN-CORE-INTEGRATION-SEAM.md | 2026-06-17 | Multi-Agent | ✅ Active | buildTool, ToolUseContext, runAgentLoop, provider widening (prerequisite) |
| PLAN-00-ORCHESTRATION-KERNEL.md | 2026-06-17 | Multi-Agent | ✅ Active | Context, tri-state gate, abort registry, events |
| PLAN-01-AGENT-DEFINITION-SYSTEM.md | 2026-06-17 | Multi-Agent | ✅ Active | TeamSchema, normalize (handoff→edge), roles/skills |
| PLAN-02-HANDOFF-CHAIN.md | 2026-06-17 | Multi-Agent | ✅ Active | HandoffPackage + payload modes |
| PLAN-03-CROSS-PROVIDER-LLM.md | 2026-06-17 | Multi-Agent | ✅ Active | OpenAICompatAdapter, serializeHandoff |
| PLAN-04-MESSAGE-BUS.md | 2026-06-17 | Multi-Agent | ✅ Active | Pub/sub + auto-delivery |
| PLAN-05-SHARED-MEMORY.md | 2026-06-17 | Multi-Agent | ✅ Active | Runtime Layer-1 KV |
| PLAN-06-LOGIC-PORTS.md | 2026-06-17 | Multi-Agent | ✅ Active | AND/OR/XOR/NAND gates + canvas diamonds |
| PLAN-07-AGENT-ASK.md | 2026-06-17 | Multi-Agent | ✅ Active | AskBroker + slot-releasing pause |
| PLAN-08-TEAM-EXECUTOR.md | 2026-06-17 | Multi-Agent | ✅ Active | Settlement loop, pool, scheduler |
| PLAN-09-CLI.md | 2026-06-17 | Multi-Agent | ✅ Active | factory agent / orchestrate |
| PLAN-10-TUI-MULTI-AGENT.md | 2026-06-17 | Multi-Agent | ✅ Active | Runtime dashboard (+ operational audit) |
| PLAN-11-COORDINATOR.md | 2026-06-17 | Multi-Agent | ✅ Active | Goal→task decomposition |
| PLAN-12-TIERED-MEMORY.md | 2026-06-17 | Multi-Agent | ✅ Active | Project/user/auto tiered memory |
| PLAN-13-ORCHESTRATION-STUDIO.md | 2026-06-17 | Multi-Agent | ✅ Active | n8n-style visual builder (+ operational audit) |

**Status**: 🟢 16-plan set, dependency-closed, `classification: PLAN` headers applied. Lives in
`docs/PLANS/` (document plans). Promoted to `specs/docs/approvedPlans/` (dated format) on
feature-dev approval. Also open in PR #23.

**Approved plans** (`specs/docs/approvedPlans/`, latest first):

| Doc | Date | Feature | Status | Purpose |
|-----|------|---------|--------|---------|
| 2026-07-04-ui-consolidation-studio.md | 2026-07-04 | UI Consolidation + Studio | ✅ Active | Addresses ddd/09–11: P0–P5 consolidation, Feature registry, standalone Studio + team dashboard |

---

## Documentation by Feature

### Logs Panel (Wave 5.5)

| Type | Doc | Date | Status |
|------|-----|------|--------|
| FEATURE | FEATURE-LOGS-PANEL-2026-06-09.md | 2026-06-09 | ✅ Active |
| TESTING | TESTING-LOGS-PANEL-2026-06-09.md | 2026-06-09 | ✅ Active |
| DESIGN | DESIGN-LOGS-PANEL-2026-06-09.md | 2026-06-09 | ✅ Active |
| ANALYSIS | ANALYSIS-DESIGN-LOGS-PANEL-2026-06-09.md | 2026-06-09 | ✅ Active |
| CHANGE | CHANGE-LOGS-PANEL-2026-06-09.md | 2026-06-09 | ✅ Active |
| REVIEW | REVIEW-DOCUMENTATION-LOGS-2026-06-09.md | 2026-06-09 | ✅ Active |
| SUMMARY | IMPLEMENTATION-COMPLETE-LOGS-PANEL-2026-06-09.md | 2026-06-09 | ✅ Active |
| INDEX | INDEX-LOGS-PANEL-DOCUMENTATION-2026-06-09.md | 2026-06-09 | ✅ Active |

**Status**: 🟢 Complete documentation suite (8 docs)

---

### factory UI / Design (Waves 0–5)

| Type | Doc | Date | Status |
|------|-----|------|--------|
| DESIGN | docs/ddd/ (14-file reference set) | 2026-06-18 | ✅ Active |
| TESTING | testing/TESTING-FACTORY-E2E-2026-06-18.md | 2026-06-18 | ✅ Active |
| REVIEW | reviews/REVIEW-CURRENT-STATE-2026-06-18.md | 2026-06-18 | ✅ Active |

**Status**: 🟢 Design reference + E2E + review (for Claude Design iteration)

---

### Multi-Agent Orchestration (PR #23 — specced)

| Type | Doc | Date | Status |
|------|-----|------|--------|
| PLAN | docs/PLANS/PLAN-* (16 plans + index) | 2026-06-17 | ✅ Active (specced) |

**Status**: 🟢 Spec set complete (dependency-closed); not yet implemented

---

### Registry Auth (Wave 5)

| Type | Doc | Date | Status |
|------|-----|------|--------|
| FEATURE | FEATURE-WAVE-5-REGISTRY-AUTH-2026-06-09.md | 2026-04-XX | ✅ Active |

**Status**: 🟡 Partial (needs testing, design, gaps docs)

---

### Terminal Panel (Wave 4)

| Type | Doc | Date | Status |
|------|-----|------|--------|
| FEATURE | FEATURE-WAVE-4-TERMINAL-PANEL-2026-05-18.md | 2026-04-XX | ✅ Active |

**Status**: 🟡 Partial (needs testing, design, gaps docs)

---

### Orchestration (Wave 3)

| Type | Doc | Date | Status |
|------|-----|------|--------|
| FEATURE | FEATURE-WAVE-3-DAG-ORCHESTRATION.md | 2026-04-XX | ✅ Active |

**Status**: 🟡 Partial (needs testing, design, gaps docs)

---

## Documentation Completeness Matrix

### Per Feature

| Feature | Feature | Testing | Design | Gaps | Analysis | Change | Study | Review | Summary |
|---------|---------|---------|--------|------|----------|--------|-------|--------|---------|
| **Logs Panel** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Registry Auth** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Terminal Panel** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Orchestration** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Legend**: ✅ = Documented | ❌ = Missing

---

## Recent Additions (Last 30 Days)

| Date | Type | Doc | Feature | Status |
|------|------|-----|---------|--------|
| 2026-07-07 | FEATURE | FEATURE-UI-CONSOLIDATION-2026-07-07.md | UI Consolidation | ✅ Active |
| 2026-07-07 | FEATURE | FEATURE-ORCHESTRATION-STUDIO-2026-07-07.md | Orchestration Studio | ✅ Active |
| 2026-07-04 | PLAN | specs/docs/approvedPlans/2026-07-04-ui-consolidation-studio.md | UI Consolidation + Studio | ✅ Active |
| 2026-06-09 | SUMMARY | IMPLEMENTATION-COMPLETE-LOGS-PANEL-2026-06-09.md | Logs Panel | ✅ Active |
| 2026-06-09 | REVIEW | INDEX-LOGS-PANEL-DOCUMENTATION-2026-06-09.md | Logs Panel | ✅ Active |
| 2026-06-09 | REVIEW | REVIEW-DOCUMENTATION-LOGS-2026-06-09.md | Logs Panel | ✅ Active |
| 2026-06-09 | CHANGE | CHANGE-LOGS-PANEL-2026-06-09.md | Logs Panel | ✅ Active |
| 2026-06-09 | ANALYSIS | ANALYSIS-DESIGN-LOGS-PANEL-2026-06-09.md | Logs Panel | ✅ Active |
| 2026-06-09 | DESIGN | DESIGN-LOGS-PANEL-2026-06-09.md | Logs Panel | ✅ Active |
| 2026-06-09 | TESTING | TESTING-LOGS-PANEL-2026-06-09.md | Logs Panel | ✅ Active |
| 2026-06-09 | FEATURE | FEATURE-LOGS-PANEL-2026-06-09.md | Logs Panel | ✅ Active |

---

## Superseded & Archived Docs

| Old Doc | Date | Reason | Replaced By | Status |
|---------|------|--------|-------------|--------|
| (None yet) | — | — | — | — |

**Note**: Old docs are kept in git history, not deleted. They're marked as SUPERSEDED in their status field.

---

## How to Use This Registry

### Before Creating a New Doc

```
1. Determine document TYPE (FEATURE, TESTING, DESIGN, GAPS, etc.)
   See: docs/documentation/DOCUMENTATION-TAXONOMY.md

2. Search this registry for existing docs
   - By feature: Look in "Documentation by Feature" section
   - By type: Look in "Documentation by Type" section
   - By date: Look in "Recent Additions" section

3. If doc exists:
   - If minor update: Update existing doc, bump last-updated date
   - If major change: Create new doc with new date, link to old

4. If doc doesn't exist:
   - Create new doc with format: TYPE-NAME-YYYY-MM-DD.md
   - Add classification header
   - Add entry to this registry
```

### Search Examples

**"I want to document testing procedures for Logs Panel"**
→ Check registry → TESTING-LOGS-PANEL-2026-06-09.md already exists
→ Decision: Update existing doc OR create new doc with new date if major changes

**"I want to analyze performance of Logs Panel"**
→ Check registry → ANALYSIS-DESIGN-LOGS-PANEL exists, but no PERFORMANCE analysis
→ Decision: Create new doc: ANALYSIS-PERFORMANCE-LOGS-PANEL-2026-06-09.md

**"I want to document gaps in Registry Auth"**
→ Check registry → No GAPS doc for Registry Auth exists
→ Decision: Create new doc: GAPS-REGISTRY-AUTH-2026-06-09.md

---

## Maintenance

This registry is updated when:
- ✅ New documentation is created
- ✅ Status of doc changes (superseded, archived, etc.)
- ✅ Major doc is updated (last-updated date bumped)

**Update frequency**: Same day as doc creation/update

**Who maintains**: Documentation owner (currently: Matheus Lopes)

---

## Document Status Definitions

- **ACTIVE**: Currently maintained and applicable
- **DRAFT**: Work in progress, not yet finalized
- **IN-PROGRESS**: Actively being worked on
- **SUPERSEDED**: Replaced by newer doc; keep for reference
- **ARCHIVED**: No longer applicable; kept for historical reference
- **DEPRECATED**: Don't use; will be removed

---

## Related Documents

- **Taxonomy**: docs/documentation/DOCUMENTATION-TAXONOMY.md (classification system)
- **Templates**: docs/documentation/DOCUMENTATION-TEMPLATES.md (templates for each type)
- **Navigation**: docs/reviews/INDEX-LOGS-PANEL-DOCUMENTATION-2026-06-09.md (example index for a feature)

---

**Registry Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Next Update**: When new doc is created  
