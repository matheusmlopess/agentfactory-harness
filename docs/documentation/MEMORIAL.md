<!-- version: 1.0.0 -->
<!-- classification: SUMMARY -->
<!-- date: 2026-06-20 -->
<!-- last-updated: 2026-06-19 -->
<!-- status: ACTIVE -->
<!-- generated-by: scripts/docs-compile.sh -->

# DOCUMENTATION — Memorial (Descriptive Compendium)

> **Auto-generated** by `scripts/docs-compile.sh` — **do not edit by hand**.
> Edit the source docs in `documentation/` and re-run the script.
> Documents: **5** · ordered by creation date · each section links its source.

<a id="index"></a>
## Index

1. [Documentation Quick Start Guide](#d1) — `2026-06-09` — How to create, update, and manage documentation using the new classification system. · [[DOCUMENTATION-QUICK-START]]
2. [Documentation Registry](#d2) — `2026-06-09` — Complete index of all documentation organized by type, feature, and date. · [[DOCUMENTATION-REGISTRY]]
3. [Documentation Taxonomy & Classification System](#d3) — `2026-06-09` — Complete guide to classifying, organizing, and managing documentation for agentfactory-harness. · [[DOCUMENTATION-TAXONOMY]]
4. [Documentation Templates](#d4) — `2026-06-09` — Copy-paste templates for each documentation type with pre-filled headers and structure. · [[DOCUMENTATION-TEMPLATES]]
5. [Glossary — agentfactory-harness](#d5) — `2026-06-19` — Centralized definitions for acronyms and key terms used across the documentation. Use this for · [[GLOSSARY]]

## Glossary

Term & acronym definitions: [GLOSSARY](GLOSSARY.md) · [[GLOSSARY]]

---

<a id="d1"></a>

## 1 · 2026-06-09 · Documentation Quick Start Guide

Source: [DOCUMENTATION-QUICK-START.md](DOCUMENTATION-QUICK-START.md) · [[DOCUMENTATION-QUICK-START]]  ·  [↑ Index](#index)


How to create, update, and manage documentation using the new classification system.

---

## 🚀 Quick Start (5 minutes)

### Step 1: Determine Document Type

What are you documenting? Choose one:

| Type | When to Use | Example |
|------|------------|---------|
| **FEATURE** | How to use/operate a feature | "How the Logs Panel works" |
| **TESTING** | How to test a feature | "Test procedures for Logs Panel" |
| **DESIGN** | Why design choices were made | "Design decisions in Logs Panel" |
| **GAPS** | Missing features and future work | "Gaps in Logs Panel" |
| **ANALYSIS** | Deep-dive into performance/security/etc | "Performance analysis of Logs Panel" |
| **CHANGE** | What code/behavior changed | "Code changes in Logs Panel" |
| **STUDY** | Research & exploration (pre-decision) | "Logging strategies exploration" |
| **REVIEW** | Audit, verification, approval | "Documentation review of Logs Panel" |
| **ARCHITECTURE** | System design & structure | "Architecture of Logs Panel" |
| **SUMMARY** | Executive overview & status | "Implementation status of Logs Panel" |
| **PLAN** | Spec-driven implementation plan (docs/PLANS/) | "PLAN-08 Team Executor spec" |

**👉 See full descriptions**: `docs/documentation/DOCUMENTATION-TAXONOMY.md`

---

### Step 2: Check if Doc Already Exists

**Before creating**, check the registry:

```bash
# Open the registry
cat docs/documentation/DOCUMENTATION-REGISTRY.md

# Or search from command line
grep -r "LOGS-PANEL" docs/documentation/DOCUMENTATION-REGISTRY.md
```

**Find** the feature/system name in the registry.

**Check** if a doc of that type already exists.

---

### Step 3: Decide: Create vs. Update

| Situation | Action |
|-----------|--------|
| Doc exists, minor fix | Update existing, bump `last-updated` date |
| Doc exists, major changes | Create new doc with new date, link to old |
| Doc doesn't exist | Create new doc with today's date |

---

### Step 4: Create the Document

**Option A: Copy Template**

```bash
# 1. Find the template for your type
vim docs/documentation/DOCUMENTATION-TEMPLATES.md
#    (search for your TYPE)

# 2. Copy the template to a new file
cp docs/documentation/DOCUMENTATION-TEMPLATES.md \
   docs/TYPE-<NAME>-$(date +%Y-%m-%d).md

# 3. Edit the file
vim docs/TYPE-<NAME>-2026-06-09.md
```

**Option B: Manual**

```bash
# 1. Create file with correct naming
touch docs/FEATURE-LOGS-PANEL-$(date +%Y-%m-%d).md

# 2. Add version header (REQUIRED)
cat > docs/FEATURE-LOGS-PANEL-2026-06-09.md << 'EOF'
<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->

# Feature: [Name]

[Content...]
EOF

# 3. Edit
vim docs/FEATURE-LOGS-PANEL-2026-06-09.md
```

---

### Step 5: Update the Registry

Add an entry to `docs/documentation/DOCUMENTATION-REGISTRY.md`:

```markdown
| FEATURE-LOGS-PANEL-2026-06-09.md | 2026-06-09 | Logs Panel | ✅ Active | Live logging, metrics, auto-analysis |
```

---

### Step 6: Commit

```bash
git add docs/FEATURE-LOGS-PANEL-2026-06-09.md
git add docs/documentation/DOCUMENTATION-REGISTRY.md
git commit -m "docs: FEATURE Logs Panel — live logging, metrics, auto-analysis

Classification: FEATURE
Date: 2026-06-09
Content: Architecture, workflows, configuration, error handling

Also updated DOCUMENTATION-REGISTRY.md to track new doc."
```

---

## 📋 Common Workflows

### Workflow 1: Create a Feature Doc

```bash
# 1. Check if FEATURE doc exists
grep "FEATURE.*LOGS-PANEL" docs/documentation/DOCUMENTATION-REGISTRY.md

# 2. Get template
head -30 docs/documentation/DOCUMENTATION-TEMPLATES.md | grep -A 30 "FEATURE Doc Template"

# 3. Create file with template
cat > docs/FEATURE-LOGS-PANEL-$(date +%Y-%m-%d).md << 'EOF'
<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->

# Feature: Logs Panel

[Fill in using template from DOCUMENTATION-TEMPLATES.md]
EOF

# 4. Update registry
vim docs/documentation/DOCUMENTATION-REGISTRY.md
# Add: | FEATURE-LOGS-PANEL-2026-06-09.md | 2026-06-09 | Logs Panel | ✅ Active | [description] |

# 5. Commit
git add docs/FEATURE-LOGS-PANEL-2026-06-09.md docs/documentation/DOCUMENTATION-REGISTRY.md
git commit -m "docs: FEATURE Logs Panel — [description]"
```

---

### Workflow 2: Update Existing Doc

```bash
# 1. Check what date it has
ls -la docs/FEATURE-LOGS-PANEL*.md
# Output: docs/FEATURE-LOGS-PANEL-2026-06-09.md

# 2. Edit the existing file
vim docs/FEATURE-LOGS-PANEL-2026-06-09.md
# Update: <!-- last-updated: 2026-06-09 -->

# 3. Commit
git add docs/FEATURE-LOGS-PANEL-2026-06-09.md
git commit -m "docs: FEATURE Logs Panel — clarify workflows section"
```

---

### Workflow 3: Create New Analysis (Different Date)

```bash
# 1. Check existing analyses
grep "ANALYSIS.*LOGS-PANEL" docs/documentation/DOCUMENTATION-REGISTRY.md

# 2. Previous was: ANALYSIS-DESIGN-LOGS-PANEL-2026-06-09.md
# Now I want: ANALYSIS-PERFORMANCE-LOGS-PANEL-2026-06-10.md (different date)

# 3. Create new doc
cat > docs/reviews/ANALYSIS-PERFORMANCE-LOGS-PANEL-$(date +%Y-%m-%d).md << 'EOF'
<!-- version: 1.0.0 -->
<!-- classification: ANALYSIS -->
<!-- analysis-type: PERFORMANCE -->
<!-- date: 2026-06-10 -->
<!-- last-updated: 2026-06-19 -->
<!-- status: ACTIVE -->
<!-- related-docs: ANALYSIS-DESIGN-LOGS-PANEL-2026-06-09.md -->

# Analysis: Performance of Logs Panel

[Content...]
EOF

# 4. Update registry
vim docs/documentation/DOCUMENTATION-REGISTRY.md

# 5. Commit
git add docs/reviews/ANALYSIS-PERFORMANCE-LOGS-PANEL-2026-06-10.md \
         docs/documentation/DOCUMENTATION-REGISTRY.md
git commit -m "docs: ANALYSIS Performance — render time, memory usage"
```

---

## 📁 Directory Structure Reference

```
docs/
├── documentation/                      ← Governance docs (this system)
│   ├── DOCUMENTATION-TAXONOMY.md       ← Classification system (read first)
│   ├── DOCUMENTATION-TEMPLATES.md      ← Templates for all types
│   ├── DOCUMENTATION-QUICK-START.md    ← This file
│   └── DOCUMENTATION-REGISTRY.md       ← Index of all docs (update every time)
│
├── WAVE-PLAN.md  FUTURE-WORK.md         ← roadmap docs (stay at root)
│
├── features/                           ← FEATURE-<NAME>-<DATE>.md
├── testing/                            ← TESTING-<NAME>-<DATE>.md
├── changes/                            ← CHANGE-<NAME>-<DATE>.md
├── PLANS/                              ← Document PLANs (PLAN-*) pending approval
│   └── PLAN-*.md                       ← promoted to specs/docs/approvedPlans/ (dated) on approval
├── ddd/                                ← design reference set (kept structure)
├── assets/                             ← images
│
└── reviews/                            ← DESIGN- / GAPS- / ANALYSIS- / REVIEW- / INDEX- / IMPLEMENTATION-*.md
```

---

## ✅ Checklist Before Creating Doc

- [ ] Determined document TYPE
- [ ] Checked DOCUMENTATION-REGISTRY.md for existing docs
- [ ] Decided to CREATE vs UPDATE
- [ ] Used correct filename format: `TYPE-NAME-YYYY-MM-DD.md`
- [ ] Added version header with all required fields
- [ ] Filled in template content (from DOCUMENTATION-TEMPLATES.md)
- [ ] Used terminal-friendly formatting (Unicode box-drawing only)
- [ ] Added links to related docs
- [ ] Updated DOCUMENTATION-REGISTRY.md
- [ ] Committed with descriptive message
- [ ] No broken references (all linked docs exist)

---

## 🔍 Searching Documentation

### Find all FEATURE docs
```bash
grep -r "<!-- classification: FEATURE -->" docs/
```

### Find all docs about Logs Panel
```bash
find docs -name "*LOGS-PANEL*" -type f
```

### Find docs updated today
```bash
grep -r "<!-- last-updated: $(date +%Y-%m-%d) -->" docs/
```

### Find docs by type
```bash
grep -r "<!-- classification: DESIGN -->" docs/
grep -r "<!-- classification: TESTING -->" docs/
grep -r "<!-- classification: GAPS -->" docs/
```

---

## 📅 Naming Conventions

### Correct Format
```
TYPE-NAME-YYYY-MM-DD.md

FEATURE-LOGS-PANEL-2026-06-09.md       ✅
TESTING-LOGS-PANEL-2026-06-09.md       ✅
DESIGN-LOGS-PANEL-2026-06-09.md        ✅
ANALYSIS-PERFORMANCE-LOGS-2026-06-10.md ✅
```

### Incorrect (Don't do this)
```
FEATURE-LOGS-PANEL.md                   ❌ No date
feature-logs-panel-2026-06-09.md        ❌ Lowercase
FEATURE_LOGS_PANEL_2026-06-09.md        ❌ Underscores
FEATURE-LOGS-PANEL-June-9-2026.md       ❌ Wrong date format
```

---

## 🏷️ Version Header Explained

```markdown
<!-- version: 1.0.0 -->              ← Document version (major.minor.patch)
<!-- classification: FEATURE -->     ← Type: FEATURE, TESTING, DESIGN, etc.
<!-- date: 2026-06-09 -->            ← Creation date (ISO format YYYY-MM-DD)
<!-- last-updated: 2026-06-09 -->    ← Last update date
<!-- status: ACTIVE -->              ← DRAFT, ACTIVE, SUPERSEDED, ARCHIVED

<!-- Optional fields -->
<!-- analysis-type: PERFORMANCE -->     ← For ANALYSIS docs
<!-- review-type: DOCUMENTATION -->     ← For REVIEW docs
<!-- reviewed-by: Name, Title -->       ← Who reviewed it
<!-- related-docs: OTHER-2026-06-09.md -->  ← Links to related docs
```

---

## 🚨 Common Mistakes

| Mistake | Why Bad | Fix |
|---------|---------|-----|
| No date in filename | Can't tell when created | Always use YYYY-MM-DD |
| No version header | Can't track status | Add required header |
| Mixed lowercase/uppercase | Inconsistent | Use UPPERCASE-HYPHEN-FORMAT |
| Outdated last-updated | Confusing if stale | Update when you edit |
| No entry in registry | Can't find doc later | Add row to DOCUMENTATION-REGISTRY.md |
| Broken links | Readers can't navigate | Use format: `FILENAME.md` in brackets |
| Create duplicate doc | Confusion, maintenance nightmare | Check registry first |

---

## 📞 Support

### Questions about Classification?
→ Read: `docs/documentation/DOCUMENTATION-TAXONOMY.md` (full definitions)

### Need a Template?
→ Read: `docs/documentation/DOCUMENTATION-TEMPLATES.md` (copy-paste templates)

### Want to Find a Doc?
→ Check: `docs/documentation/DOCUMENTATION-REGISTRY.md` (index of all docs)

### Not Sure if Doc Exists?
→ Search: `grep -r "FEATURE-NAME" docs/documentation/DOCUMENTATION-REGISTRY.md`

---

## 📚 Learning Resources

| Resource | Purpose |
|----------|---------|
| DOCUMENTATION-TAXONOMY.md | Full doc type definitions & naming rules |
| DOCUMENTATION-TEMPLATES.md | Copy-paste templates for each type |
| DOCUMENTATION-REGISTRY.md | Index of all docs (search before creating) |
| DOCUMENTATION-QUICK-START.md | This file (workflows & examples) |

**Recommended reading order**:
1. This file (QUICK-START) — 5 min
2. TAXONOMY — 10 min (understand doc types)
3. TEMPLATES — as needed (copy templates)
4. REGISTRY — before creating (check if exists)

---

## 🎯 Examples

### Example 1: Create a FEATURE Doc

```bash
# Feature: Registry Auth Login
# Date: 2026-06-15

# 1. Check registry
grep "REGISTRY-AUTH" docs/documentation/DOCUMENTATION-REGISTRY.md
# → Found: FEATURE-WAVE-5-REGISTRY-AUTH.md (old, needs update)

# 2. Decide
# → Update existing (same date) OR create new version-dated doc
# → Decision: Create new: FEATURE-REGISTRY-AUTH-LOGIN-2026-06-15.md

# 3. Create file
cat > docs/FEATURE-REGISTRY-AUTH-LOGIN-2026-06-15.md << 'EOF'
<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-06-15 -->
<!-- last-updated: 2026-06-19 -->
<!-- status: ACTIVE -->

# Feature: Registry Authentication & Login

[Use FEATURE template from DOCUMENTATION-TEMPLATES.md]
EOF

# 4. Update registry
# → Add row: | FEATURE-REGISTRY-AUTH-LOGIN-2026-06-15.md | 2026-06-15 | Registry Auth | ✅ Active | Device-code login, key management |

# 5. Commit
git add docs/FEATURE-REGISTRY-AUTH-LOGIN-2026-06-15.md docs/documentation/DOCUMENTATION-REGISTRY.md
git commit -m "docs: FEATURE Registry Auth Login — 2026-06-15

Device-code OAuth flow, JWT storage, key import/export"
```

---

### Example 2: Create a GAPS Doc

```bash
# System: Logs Panel
# Date: 2026-06-16 (new analysis found gaps)

# 1. Check registry
grep "GAPS.*LOGS-PANEL" docs/documentation/DOCUMENTATION-REGISTRY.md
# → Not found (GAPS doc doesn't exist yet)

# 2. Create
cat > docs/reviews/GAPS-LOGS-PANEL-2026-06-16.md << 'EOF'
<!-- version: 1.0.0 -->
<!-- classification: GAPS -->
<!-- date: 2026-06-16 -->
<!-- last-updated: 2026-06-19 -->
<!-- status: ACTIVE -->
<!-- related-docs: DESIGN-LOGS-PANEL-2026-06-09.md -->

# Gaps & Missing Features: Logs Panel

## Gap 1: Analysis Timeout

**Impact**: High — analysis could hang indefinitely

[Use GAPS template...]
EOF

# 3. Update registry
# → Add row: | GAPS-LOGS-PANEL-2026-06-16.md | 2026-06-16 | Logs Panel | ✅ Active | 6 gaps identified, P0 blocker for timeout |

# 4. Commit
git add docs/reviews/GAPS-LOGS-PANEL-2026-06-16.md docs/documentation/DOCUMENTATION-REGISTRY.md
git commit -m "docs: GAPS Logs Panel — analysis timeout, confirmation, persistence"
```

---

## 🎓 Next Steps

1. **Read** `docs/documentation/DOCUMENTATION-TAXONOMY.md` for full details
2. **Bookmark** `docs/documentation/DOCUMENTATION-REGISTRY.md` (check before creating docs)
3. **Copy** templates from `docs/documentation/DOCUMENTATION-TEMPLATES.md` when creating
4. **Follow** this workflow every time you create documentation
5. **Update** registry + commit with clear message

---

**Guide Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  

---

<a id="d2"></a>

## 2 · 2026-06-09 · Documentation Registry

Source: [DOCUMENTATION-REGISTRY.md](DOCUMENTATION-REGISTRY.md) · [[DOCUMENTATION-REGISTRY]]  ·  [↑ Index](#index)


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
| **FEATURE** | 4 | 2026-06-09 | ✅ Active |
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

---

<a id="d3"></a>

## 3 · 2026-06-09 · Documentation Taxonomy & Classification System

Source: [DOCUMENTATION-TAXONOMY.md](DOCUMENTATION-TAXONOMY.md) · [[DOCUMENTATION-TAXONOMY]]  ·  [↑ Index](#index)


Complete guide to classifying, organizing, and managing documentation for agentfactory-harness.

---

## Overview

This taxonomy defines:
- **Document types** (feature, study, design, gaps, analysis, testing, etc.)
- **Classification categories** (what subject it covers)
- **Naming conventions** (how to name docs)
- **Timestamp format** (when it was created/updated)
- **Storage location** (where docs live)
- **Update protocol** (how to update vs. create new)

All new documentation MUST follow this classification system.

---

## Document Types

### 1. FEATURE Docs
**Purpose**: Describe what a feature does, how to use it, workflows, configuration.

**Audience**: End users, product managers, developers using the feature.

**Content**:
- Overview & problem statement
- Architecture & design
- Workflows (happy path, edge cases)
- Configuration reference
- Keyboard & mouse interactions
- Error handling
- Future enhancements

**Naming Convention**:
```
FEATURE-<FEATURE-NAME>-<DATE>.md
FEATURE-LOGS-PANEL-2026-06-09.md
```

**Location**: `docs/features/` or `docs/`

**Version Header**:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
```

**Update Protocol**: 
- Minor clarifications → Update existing doc, bump date in title & header
- New feature sections → Create new doc with new date, reference old doc
- Entire rewrite → Create new doc, archive old in git history

**Example**: `docs/FEATURE-LOGS-PANEL-2026-06-09.md`

---

### 2. TESTING Docs
**Purpose**: Define test procedures, test cases, expected results, failure indicators.

**Audience**: QA engineers, testers, developers verifying features.

**Content**:
- Environment setup
- Test categories & cases
- Expected results & validation
- Failure checklist
- Test report template
- Pre-commit checklist

**Naming Convention**:
```
TESTING-<FEATURE-NAME>-<DATE>.md
TESTING-LOGS-PANEL-2026-06-09.md
```

**Location**: `docs/testing/`

**Version Header**:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: TESTING -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
```

**Update Protocol**:
- New test cases → Update existing doc, bump date
- Different testing approach → Create new doc with new date
- Test framework change → Create new doc (old approach becomes reference)

**Example**: `docs/testing/TESTING-LOGS-PANEL-2026-06-09.md`

---

### 3. DESIGN Docs
**Purpose**: Document design decisions, trade-offs, assumptions, and architectural reasoning.

**Audience**: Architects, senior engineers, design reviewers.

**Content**:
- Design decisions with alternatives
- Trade-off analysis matrices
- Rationale for choices
- Assumptions made
- Future refactoring options

**Naming Convention**:
```
DESIGN-<FEATURE-NAME>-<DATE>.md
DESIGN-LOGS-PANEL-2026-06-09.md
```

**Location**: `docs/reviews/` or `docs/design/`

**Version Header**:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: DESIGN -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
```

**Update Protocol**:
- Rationale clarification → Update existing doc
- New design approach → Create new doc with new date, reference old decision
- Architecture change → Create new doc, link to old as "superseded"

**Example**: `docs/reviews/DESIGN-LOGS-PANEL-2026-06-09.md`

---

### 4. GAPS Docs
**Purpose**: Document missing features, identified risks, limitations, and future work.

**Audience**: Product managers, engineers, architects planning future work.

**Content**:
- List of gaps/missing features
- Impact assessment for each gap
- Mitigation strategies
- Priority levels (P0, P1, P2, etc.)
- Effort estimates
- Timeline recommendations
- Relationship to other gaps

**Naming Convention**:
```
GAPS-<SYSTEM-NAME>-<DATE>.md
GAPS-LOGS-PANEL-2026-06-09.md
```

**Location**: `docs/reviews/` or `docs/gaps/`

**Version Header**:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: GAPS -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
```

**Update Protocol**:
- Gap resolved → Mark as RESOLVED in the doc, update date
- New gap discovered → Add to existing doc, update last-updated date
- Complete rewrite (many gaps) → Create new doc with new date

**Example**: `docs/reviews/GAPS-LOGS-PANEL-2026-06-09.md`

---

### 5. ANALYSIS Docs
**Purpose**: Deep-dive analysis of implementation, performance, security, or architectural aspects.

**Audience**: Architects, senior engineers, code reviewers, security teams.

**Content**:
- Detailed examination of a system or feature
- Performance measurements
- Security review findings
- Architectural evaluation
- Recommendations & trade-offs

**Naming Convention**:
```
ANALYSIS-<ASPECT>-<DATE>.md
ANALYSIS-PERFORMANCE-LOGS-2026-06-09.md
ANALYSIS-SECURITY-LOGS-2026-06-09.md
```

**Location**: `docs/reviews/` or `docs/analysis/`

**Version Header**:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: ANALYSIS -->
<!-- analysis-type: DESIGN | PERFORMANCE | SECURITY | ARCHITECTURE -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
```

**Update Protocol**:
- New findings → Create new analysis doc (time-dated snapshots are valuable)
- Minor corrections → Update existing doc
- Superseded findings → Create new doc, reference old as "previous analysis"

**Example**: `docs/reviews/ANALYSIS-DESIGN-LOGS-PANEL-2026-06-09.md`

---

### 6. CHANGE Docs
**Purpose**: Document what changed (code, behavior, architecture) with before/after comparison.

**Audience**: Engineers reviewing changes, QA verifying behavior, documentation writers.

**Content**:
- Before/after code structure
- File-by-file changes
- Behavioral workflow changes
- Control flow & data flow diagrams
- Performance impact
- Breaking changes (if any)

**Naming Convention**:
```
CHANGE-<FEATURE-NAME>-<DATE>.md
CHANGE-LOGS-PANEL-2026-06-09.md
```

**Location**: `docs/` or `docs/changes/`

**Version Header**:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: CHANGE -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
```

**Update Protocol**:
- Clarification of changes → Update existing doc
- Additional changes needed → Update existing doc (ongoing)
- Major refactor → Create new change doc for that refactor

**Example**: `docs/CHANGE-LOGS-PANEL-2026-06-09.md`

---

### 7. STUDY Docs
**Purpose**: Research, exploration, and investigation documents. Often precede design decisions.

**Audience**: Engineers exploring solutions, architects evaluating approaches.

**Content**:
- Problem investigation
- Solution exploration
- Pros/cons of different approaches
- Proof-of-concept results
- Learnings & insights

**Naming Convention**:
```
STUDY-<TOPIC>-<DATE>.md
STUDY-LOGGING-STRATEGIES-2026-06-09.md
```

**Location**: `docs/studies/` or `docs/research/`

**Version Header**:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: STUDY -->
<!-- status: IN-PROGRESS | COMPLETED | SUPERSEDED -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
```

**Update Protocol**:
- Ongoing investigation → Update existing doc, change status to IN-PROGRESS
- Investigation complete → Update status to COMPLETED, freeze the doc
- Superseded by new study → Create new doc, link old doc as reference

**Example**: `docs/studies/STUDY-LOGGING-STRATEGIES-2026-06-09.md`

---

### 8. REVIEW Docs
**Purpose**: Review, audit, or verification documents. Used to verify completeness, quality, or alignment.

**Audience**: Quality assurance, documentation managers, architects, reviewers.

**Content**:
- Checklist items
- Verification results
- Audit findings
- Compliance checks
- Sign-off & approval status

**Naming Convention**:
```
REVIEW-<ASPECT>-<DATE>.md
REVIEW-DOCUMENTATION-2026-06-09.md
REVIEW-SECURITY-2026-06-09.md
```

**Location**: `docs/reviews/`

**Version Header**:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: REVIEW -->
<!-- review-type: DOCUMENTATION | SECURITY | ARCHITECTURE | CODE | PERFORMANCE -->
<!-- status: PENDING | APPROVED | APPROVED-WITH-CONDITIONS | REJECTED -->
<!-- reviewed-by: name, date -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
```

**Update Protocol**:
- Follow-up review → Update status, bump last-updated date, add review note
- Full re-review → Create new review doc with new date (time-stamped approval is valuable)

**Example**: `docs/reviews/REVIEW-DOCUMENTATION-LOGS-2026-06-09.md`

---

### 9. ARCHITECTURE Docs
**Purpose**: Describe system architecture, component interactions, and structural design.

**Audience**: Architects, senior engineers, new team members understanding system.

**Content**:
- Architecture overview
- Component descriptions
- Data flow
- Integration points
- Deployment architecture
- Technology choices

**Naming Convention**:
```
ARCHITECTURE-<SYSTEM>-<VERSION>-<DATE>.md
ARCHITECTURE-LOGS-PANEL-v1.0-2026-06-09.md
```

**Location**: `docs/architecture/` or `docs/`

**Version Header**:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: ARCHITECTURE -->
<!-- system: LOGS-PANEL -->
<!-- architecture-version: 1.0 -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
```

**Update Protocol**:
- Minor clarification → Update existing doc
- Architectural change → Create new doc with new architecture-version & date

**Example**: `docs/architecture/ARCHITECTURE-LOGS-PANEL-v1.0-2026-06-09.md`

---

### 10. SUMMARY Docs
**Purpose**: Executive summaries, status reports, or integration documents that tie other docs together.

**Audience**: Project managers, stakeholders, anyone needing high-level overview.

**Content**:
- Executive summary
- Status & verification results
- References to detailed docs
- Key metrics & statistics
- Next steps & recommendations

**Naming Convention**:
```
SUMMARY-<FEATURE>-<DATE>.md
or
<FEATURE>-SUMMARY-<DATE>.md

SUMMARY-LOGS-PANEL-2026-06-09.md
IMPLEMENTATION-LOGS-PANEL-SUMMARY-2026-06-09.md
```

**Location**: `docs/` or `docs/summaries/`

**Version Header**:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: SUMMARY -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
```

**Update Protocol**:
- Status update → Update existing doc, bump date
- Major milestone → Create new summary doc for that milestone

**Example**: `docs/SUMMARY-LOGS-PANEL-2026-06-09.md`

---

### 11. PLAN Docs
**Purpose**: Spec-driven implementation plans — a self-contained specification for one feature
that an LLM/engineer can implement from directly (interfaces, diagrams, contracts, tests, DoD).

**Audience**: Engineers and agents implementing the feature; reviewers approving scope.

**Content**:
- Overview & purpose
- Interface definitions (types, schemas, signatures)
- Mermaid diagrams for each scenario
- Codebase reality (assumed symbol → real symbol → fix) and Contracts (imports/exports)
- Edge cases & error handling
- Test cases (unit + integration)
- Definition of Done / verification checklist
- `depends-on` / `enables` relationships to sibling plans

**Naming Convention**:
```
PLAN-<NN>-<NAME>.md          (ordered spec sets — NN = 00..99 or CORE)
PLAN-<NAME>-<DATE>.md         (standalone plans)

PLAN-00-ORCHESTRATION-KERNEL.md
PLAN-CORE-INTEGRATION-SEAM.md
```

**Location**: `docs/PLANS/`.

> **PLAN docs vs approved CLI plans — keep these separate:**
> - `docs/PLANS/PLAN-*.md` — **document plans** authored from studies/sessions, *pending*
>   feature-dev approval. This taxonomy type.
> - `specs/docs/approvedPlans/<YYYY-MM-DD>-<name>.md` — **CLI-approved plans** (approved via the
>   plan workflow, governed by `.ai/rules/approved-plans.md`). Dated format; **not** the
>   `PLAN-*` naming and **not** classified by this taxonomy.
>
> **Promotion lifecycle:** a `docs/PLANS/PLAN-NN-*.md` that is approved in a feature-dev session
> is moved to `specs/docs/approvedPlans/` and **renamed to the dated form**
> `<YYYY-MM-DD>-<name>.md` (the CLI-approved-plan format).

**Version Header**:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: PLAN -->
<!-- date: 2026-06-17 -->
<!-- last-updated: 2026-06-19 -->
<!-- feature: src/<paths the plan implements> -->
<!-- depends-on: PLAN-NN, ... -->
<!-- enables: PLAN-NN, ... -->
```

**Update Protocol**:
- Spec refinement → update existing plan, bump `last-updated` + `version`
- Scope change / supersede → new plan with new name, reference the old as superseded
- On implementation → the plan stays as the approved record; the feature doc (FEATURE type)
  documents the shipped result

**Example**: `docs/PLANS/PLAN-08-TEAM-EXECUTOR.md`

---

## Naming Convention Summary

```
<TYPE>-<NAME>-<DATE>.md

Where:
  <TYPE>     = FEATURE | TESTING | DESIGN | GAPS | ANALYSIS | CHANGE | STUDY | REVIEW | ARCHITECTURE | SUMMARY | PLAN
  <NAME>     = Feature/system name (LOGS-PANEL, REGISTRY-AUTH, etc.)
  <DATE>     = YYYY-MM-DD (ISO format, today's date or creation date)

Examples:
  FEATURE-LOGS-PANEL-2026-06-09.md
  TESTING-LOGS-PANEL-2026-06-09.md
  DESIGN-LOGS-PANEL-2026-06-09.md
  GAPS-LOGS-PANEL-2026-06-09.md
  ANALYSIS-PERFORMANCE-LOGS-2026-06-09.md
  CHANGE-LOGS-PANEL-2026-06-09.md
  STUDY-LOGGING-STRATEGIES-2026-06-09.md
  REVIEW-DOCUMENTATION-2026-06-09.md
  ARCHITECTURE-LOGS-PANEL-v1.0-2026-06-09.md
  SUMMARY-LOGS-PANEL-2026-06-09.md
```

---

## Version Header Template

Every document MUST include this header:

```markdown
<!-- version: X.Y.Z -->
<!-- classification: <TYPE> -->
<!-- date: YYYY-MM-DD -->
<!-- last-updated: YYYY-MM-DD -->
<!-- status: DRAFT | ACTIVE | SUPERSEDED | ARCHIVED -->
```

**Optional fields** (add when relevant):

```markdown
<!-- analysis-type: DESIGN | PERFORMANCE | SECURITY | ARCHITECTURE -->
<!-- review-type: DOCUMENTATION | SECURITY | ARCHITECTURE | CODE -->
<!-- reviewed-by: Name, Title | 2026-06-09 -->
<!-- supersedes: DOCUMENT-NAME-DATE.md -->
<!-- related-docs: DOCUMENT-NAME-DATE.md, DOCUMENT-NAME-DATE.md -->
<!-- status: PENDING | APPROVED | APPROVED-WITH-CONDITIONS | REJECTED -->
```

---

## Directory Structure

Recommended organization:

```
docs/
├── FEATURE-*.md                    ← Feature operational guides
├── CHANGE-*.md                     ← Code & behavior change docs
├── SUMMARY-*.md                    ← Executive summaries
├── README.md                       ← Index of all docs
│
├── features/                       ← Feature-specific docs
│   ├── FEATURE-*.md
│   ├── WAVE-*.md
│   └── ...
│
├── testing/                        ← Testing documentation
│   ├── TESTING-*.md
│   └── ...
│
├── studies/                        ← Research & exploration
│   ├── STUDY-*.md
│   └── ...
│
├── architecture/                   ← Architecture docs
│   ├── ARCHITECTURE-*.md
│   └── ...
│
└── reviews/                        ← Analysis, gaps, reviews, design
    ├── DESIGN-*.md
    ├── GAPS-*.md
    ├── ANALYSIS-*.md
    ├── REVIEW-*.md
    ├── INDEX-*.md
    └── ...
```

---

## When to Create vs. Update

### CREATE a new doc if:
- ✅ Different date needed (investigation/analysis at different time)
- ✅ Different version or iteration
- ✅ Substantial structural change (full rewrite)
- ✅ Different aspect being analyzed (ANALYSIS-PERFORMANCE vs ANALYSIS-SECURITY)
- ✅ Same type but major evolution (v1.0 → v2.0)

### UPDATE existing doc if:
- ✅ Clarification or correction
- ✅ Additional detail in same scope
- ✅ Bug fix in description
- ✅ Minor reorganization
- ✅ New findings within same analysis

### Example Flow:

```
2026-06-08: Create STUDY-LOGGING-STRATEGIES-2026-06-08.md (investigation)
              ↓
2026-06-08: Update existing study with findings (same day)
              ↓
2026-06-09: Create DESIGN-LOGS-PANEL-2026-06-09.md (decisions from study)
              ↓
2026-06-09: Update DESIGN doc with clarifications (same day)
              ↓
2026-06-10: Create ANALYSIS-PERFORMANCE-LOGS-2026-06-10.md (new analysis)
              ↓
2026-06-12: Create TESTING-LOGS-PANEL-2026-06-12.md (test procedures)
```

---

## Documentation Registry

See: `docs/documentation/DOCUMENTATION-REGISTRY.md`

This file maintains an index of all docs organized by:
- Type (FEATURE, TESTING, DESIGN, etc.)
- Feature/System (LOGS-PANEL, REGISTRY-AUTH, etc.)
- Date (newest first)
- Status (ACTIVE, SUPERSEDED, ARCHIVED)

**Check this before creating a new doc** — it prevents duplicate documentation.

---

## Querying Documentation

### Find all docs about Logs Panel:
```bash
grep -r "LOGS-PANEL" docs/ | grep "<!-- classification"
# or
ls -la docs/*/LOGS-PANEL* docs/LOGS-PANEL*
```

### Find all FEATURE docs:
```bash
grep -r "<!-- classification: FEATURE -->" docs/
```

### Find docs updated today:
```bash
grep -r "<!-- last-updated: 2026-06-09 -->" docs/
```

### Find docs by type:
```bash
grep -r "<!-- classification: DESIGN -->" docs/
grep -r "<!-- classification: TESTING -->" docs/
grep -r "<!-- classification: GAPS -->" docs/
```

---

## Examples of Classification

### Before (Old Style)
```
docs/features/FEATURE-LOGS-PANEL-2026-06-09.md
docs/testing/TESTING-LOGS-PANEL-2026-06-09.md
docs/changes/CHANGE-LOGS-PANEL-2026-06-09.md
docs/reviews/DESIGN-ANALYSIS-LOGS-PANEL-2026-06-09.md
```

### After (New Style - Classified)
```
docs/FEATURE-LOGS-PANEL-2026-06-09.md
docs/testing/TESTING-LOGS-PANEL-2026-06-09.md
docs/CHANGE-LOGS-PANEL-2026-06-09.md
docs/reviews/DESIGN-LOGS-PANEL-2026-06-09.md
docs/reviews/GAPS-LOGS-PANEL-2026-06-09.md
docs/reviews/ANALYSIS-DESIGN-LOGS-PANEL-2026-06-09.md
docs/reviews/REVIEW-DOCUMENTATION-LOGS-2026-06-09.md
docs/SUMMARY-LOGS-PANEL-2026-06-09.md
```

With headers:
```markdown
<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->
```

---

## Best Practices

1. **Always check DOCUMENTATION-REGISTRY.md first** before creating a doc
2. **Use consistent naming** — follow the pattern exactly
3. **Add version header** to every document
4. **Date stamp in filename** — makes it easy to find recent docs
5. **Link between docs** — reference related docs
6. **Archive old docs** — don't delete, mark as SUPERSEDED
7. **Timestamp updates** — keep last-updated current
8. **Use terminal-friendly formatting** — Unicode box-drawing, no complex tables

---

## Checklist for Creating New Doc

- [ ] Determined correct TYPE (FEATURE, TESTING, DESIGN, etc.)
- [ ] Checked DOCUMENTATION-REGISTRY.md for existing docs
- [ ] Decided to CREATE vs UPDATE existing doc
- [ ] Named file: `TYPE-NAME-YYYY-MM-DD.md`
- [ ] Added version header with classification & dates
- [ ] Placed in correct directory
- [ ] Added entry to DOCUMENTATION-REGISTRY.md
- [ ] Linked from related docs
- [ ] Used terminal-friendly formatting
- [ ] No broken references
- [ ] Committed with clear message: `docs: <TYPE> <NAME> — <summary>`

---

**Taxonomy Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  

---

<a id="d4"></a>

## 4 · 2026-06-09 · Documentation Templates

Source: [DOCUMENTATION-TEMPLATES.md](DOCUMENTATION-TEMPLATES.md) · [[DOCUMENTATION-TEMPLATES]]  ·  [↑ Index](#index)


Copy-paste templates for each documentation type with pre-filled headers and structure.

**Always use these templates** to ensure consistency and proper classification.

---

## FEATURE Doc Template

**File**: `docs/FEATURE-<NAME>-<DATE>.md` or `docs/features/FEATURE-<NAME>-<DATE>.md`

**Example**: `docs/FEATURE-LOGS-PANEL-2026-06-09.md`

```markdown
<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->
<!-- related-docs: TESTING-<NAME>-DATE.md, DESIGN-<NAME>-DATE.md -->

# Feature: [Feature Name]

One-sentence feature description.

---

## Overview

What the feature does and why it exists.

---

## Architecture

Component layout, state machine, data flow diagrams (Unicode box-drawing).

---

## Workflows

### Workflow 1: [Happy Path]

Precondition → Steps → Expected Result → Validation

### Workflow 2: [Edge Case]

Precondition → Steps → Expected Result → Validation

### Workflow N: [Error Scenario]

Precondition → Steps → Expected Result → Validation

---

## Keyboard Shortcuts

| Key | Action | Behavior |
|-----|--------|----------|
| — | — | — |

---

## Mouse Interactions

| Action | Region | Behavior |
|--------|--------|----------|
| — | — | — |

---

## Configuration

Settings, constants, thresholds.

---

## Error Handling & Recovery

Error scenarios with mitigation strategies.

---

## Future Enhancements

Short-term and long-term suggestions.

---

## References

File locations, related docs.

---

**Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  
```

---

## TESTING Doc Template

**File**: `docs/testing/TESTING-<NAME>-<DATE>.md`

**Example**: `docs/testing/TESTING-LOGS-PANEL-2026-06-09.md`

```markdown
<!-- version: 1.0.0 -->
<!-- classification: TESTING -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->
<!-- related-docs: FEATURE-<NAME>-DATE.md -->

# Testing Guide: [Feature Name]

Complete end-to-end testing procedures.

---

## Environment Setup

Preconditions, system requirements, setup steps.

---

## Test Categories

### Category A: [Category Name]

#### A1: [Test Name]

**Steps**:
1. Step 1
2. Step 2

**Expected Result**:
- Result

**Validation**:
- ✓ Check 1

---

## Failure Checklist

| Indicator | Root Cause | Debug Steps |
|-----------|-----------|------------|
| — | — | — |

---

## Test Report Template

```markdown
# Test Report: [Feature] — [Date]

## Environment
- OS: [Linux/macOS/WSL2]
- Node: [version]
- Terminal: [name + version]

## Test Results

### Category A
- [ ] A1: [Test] — PASS / FAIL / SKIP
- [ ] A2: [Test] — PASS / FAIL / SKIP

## Summary
- Passed: X/Y
- Failed: [list]
- Blockers: [any critical issues?]

## Notes
[Additional observations]
```

---

## Pre-Commit Checklist

- [ ] All tests pass
- [ ] No console errors
- [ ] Feature works as documented

---

**Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  
```

---

## DESIGN Doc Template

**File**: `docs/reviews/DESIGN-<NAME>-<DATE>.md`

**Example**: `docs/reviews/DESIGN-LOGS-PANEL-2026-06-09.md`

```markdown
<!-- version: 1.0.0 -->
<!-- classification: DESIGN -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->
<!-- related-docs: FEATURE-<NAME>-DATE.md, ANALYSIS-<NAME>-DATE.md -->

# Design: [Feature/Component Name]

Design decisions, trade-offs, and architectural reasoning.

---

## Design Reasoning

### Decision 1: [Decision Title]

**Options considered**: 3

- **Option A**: [Description] — [Pros/Cons]
- **Option B**: [Description] — [Pros/Cons]
- **Option C**: [Description] — [Pros/Cons]

**Selected**: Option [A/B/C]

**Trade-off Analysis**:

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Complexity | — | — | — |
| Performance | — | — | — |
| Maintenance | — | — | — |

**Reasoning**: Why this option was chosen.

**Future**: How this could be improved.

---

## Assumptions

| Assumption | Reasoning | Risk Level |
|-----------|-----------|-----------|
| — | — | — |

---

## Identified Gaps

| Gap | Risk | Mitigation | Timeline |
|-----|------|-----------|----------|
| — | — | — | — |

---

## Recommendations

**P0 (Blocker)**: [Item] — [Reason]

**P1 (High)**: [Item] — [Reason]

**P2 (Medium)**: [Item] — [Reason]

---

## Review Checklist

- [ ] All design decisions documented
- [ ] Trade-offs analyzed
- [ ] Assumptions listed with risks
- [ ] Gaps identified with mitigations
- [ ] Recommendations prioritized

---

**Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  
```

---

## GAPS Doc Template

**File**: `docs/reviews/GAPS-<NAME>-<DATE>.md`

**Example**: `docs/reviews/GAPS-LOGS-PANEL-2026-06-09.md`

```markdown
<!-- version: 1.0.0 -->
<!-- classification: GAPS -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->
<!-- related-docs: DESIGN-<NAME>-DATE.md -->

# Gaps & Missing Features: [Feature Name]

Identified missing features, limitations, and future work.

---

## Gap 1: [Gap Title]

**Impact**: [Medium/High/Low] — [Why it matters]

**Mitigation**: [How to address]

**Effort**: [Hours/Days]

**Timeline**: [Sprint/Quarter/Post-Release]

**Priority**: [P0/P1/P2/P3]

---

## Gap 2: [Gap Title]

[Same structure]

---

## Enhancement Opportunities

### Short-term (Next Sprint)

1. [Enhancement] — [Effort] hours, [Benefit]
2. [Enhancement] — [Effort] hours, [Benefit]

### Medium-term (This Quarter)

1. [Enhancement] — [Effort] hours, [Benefit]

### Long-term (Post-Release)

1. [Enhancement] — [Effort] hours, [Benefit]

---

## Gap Resolution Tracking

| Gap | Status | Resolved In | Notes |
|-----|--------|-----------|-------|
| [Gap 1] | OPEN | — | — |
| [Gap 2] | RESOLVED | [Feature/PR] | Closed by [date] |

---

**Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  
```

---

## ANALYSIS Doc Template

**File**: `docs/reviews/ANALYSIS-<TYPE>-<NAME>-<DATE>.md`

**Example**: `docs/reviews/ANALYSIS-PERFORMANCE-LOGS-PANEL-2026-06-09.md`

```markdown
<!-- version: 1.0.0 -->
<!-- classification: ANALYSIS -->
<!-- analysis-type: DESIGN | PERFORMANCE | SECURITY | ARCHITECTURE -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->
<!-- related-docs: FEATURE-<NAME>-DATE.md, DESIGN-<NAME>-DATE.md -->

# Analysis: [Analysis Type] of [Feature/System]

Deep-dive analysis of [aspect].

---

## Scope

What is being analyzed and why.

---

## Methodology

How the analysis was performed. Data sources, tools, assumptions.

---

## Findings

### Finding 1: [Title]

**Data/Evidence**: [Quantitative or qualitative evidence]

**Impact**: [What this means]

**Recommendation**: [How to address]

---

## Summary

Key takeaways and overall assessment.

---

## Recommendations

Prioritized list of recommendations based on findings.

---

## Appendices

Detailed data, raw measurements, test results.

---

**Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  
```

---

## CHANGE Doc Template

**File**: `docs/CHANGE-<NAME>-<DATE>.md`

**Example**: `docs/CHANGE-LOGS-PANEL-2026-06-09.md`

```markdown
<!-- version: 1.0.0 -->
<!-- classification: CHANGE -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->
<!-- related-docs: FEATURE-<NAME>-DATE.md -->

# Changes: [Feature Name]

What changed (code, behavior, architecture) with before/after comparison.

---

## Overview

Impact summary: X files changed, Y lines added, Z features affected.

---

## Project Structure: Before vs After

Tree view comparison using Unicode box-drawing.

---

## File-by-File Changes

### File 1: src/file.ts

**Changes**: [Description of changes]

**Lines**: [Added/Modified/Deleted count]

**Details**:
```typescript
// Old code
// ↓
// New code
```

---

## Behavioral Changes

### Workflow: [Name]

**BEFORE**:
```
Step 1 → Step 2 → Result
```

**AFTER**:
```
Step 1 → Step 2 → Step 3 → Result
```

**Impact**: [Why this matters]

---

## Control Flow

Diagrams showing how execution changed.

---

## Data Flow

How data moves through the system (before/after).

---

## Performance Impact

| Operation | Before | After | Change |
|-----------|--------|-------|--------|
| — | — | — | — |

---

## Breaking Changes

None OR [list what broke]

---

**Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  
```

---

## STUDY Doc Template

**File**: `docs/studies/STUDY-<TOPIC>-<DATE>.md`

**Example**: `docs/studies/STUDY-LOGGING-STRATEGIES-2026-06-09.md`

```markdown
<!-- version: 1.0.0 -->
<!-- classification: STUDY -->
<!-- status: DRAFT | IN-PROGRESS | COMPLETED | SUPERSEDED -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->

# Study: [Topic]

Research and exploration document.

---

## Problem Statement

What are we investigating and why?

---

## Approaches Investigated

### Approach 1: [Name]

**Description**: [What is this approach?]

**Pros**:
- [Advantage 1]
- [Advantage 2]

**Cons**:
- [Disadvantage 1]
- [Disadvantage 2]

**Proof of Concept**: [Findings from POC]

---

### Approach 2: [Name]

[Same structure]

---

## Learnings & Insights

Key discoveries from investigation.

---

## Recommendations

Which approach seems best and why?

---

## References

Links to related research, tools, documentation.

---

**Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: [IN-PROGRESS/COMPLETED]  
```

---

## REVIEW Doc Template

**File**: `docs/reviews/REVIEW-<TYPE>-<DATE>.md`

**Example**: `docs/reviews/REVIEW-DOCUMENTATION-2026-06-09.md`

```markdown
<!-- version: 1.0.0 -->
<!-- classification: REVIEW -->
<!-- review-type: DOCUMENTATION | SECURITY | ARCHITECTURE | CODE | PERFORMANCE -->
<!-- status: PENDING | APPROVED | APPROVED-WITH-CONDITIONS | REJECTED -->
<!-- reviewed-by: [Name, Title] | 2026-06-09 -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->

# Review: [Review Type]

Review, audit, or verification of [aspect].

---

## Scope

What is being reviewed?

---

## Verification Checklist

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion N

---

## Findings

| Finding | Severity | Status |
|---------|----------|--------|
| — | — | — |

---

## Recommendations

### Must Fix (Before Approval)

1. [Requirement] — [Reason]

### Should Fix (Before Release)

1. [Recommendation] — [Benefit]

### Nice to Have (Future)

1. [Enhancement] — [Value]

---

## Sign-Off

**Reviewed By**: [Name, Title]

**Date**: [Date]

**Status**: ✅ APPROVED / ⚠️ APPROVED-WITH-CONDITIONS / ❌ REJECTED

**Comments**: [Any additional notes]

---

**Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  
```

---

## ARCHITECTURE Doc Template

**File**: `docs/architecture/ARCHITECTURE-<SYSTEM>-v<VERSION>-<DATE>.md`

**Example**: `docs/architecture/ARCHITECTURE-LOGS-PANEL-v1.0-2026-06-09.md`

```markdown
<!-- version: 1.0.0 -->
<!-- classification: ARCHITECTURE -->
<!-- system: LOGS-PANEL -->
<!-- architecture-version: 1.0 -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->

# Architecture: [System Name] v[Version]

System architecture, components, and interactions.

---

## Architecture Overview

High-level diagram (Mermaid or Unicode box-drawing).

---

## Components

### Component 1: [Name]

**Purpose**: [What it does]

**Responsibilities**: [Key functions]

**Dependencies**: [What it depends on]

**API**: [Public interface]

---

## Data Flow

How data moves through the system.

---

## Integration Points

How this system integrates with others.

---

## Deployment Architecture

Infrastructure requirements, deployment topology.

---

## Technology Stack

Languages, frameworks, libraries, databases.

---

## Design Rationale

Why this architecture was chosen over alternatives.

---

## Scalability & Performance

How the system scales, performance characteristics.

---

## Security Considerations

Security-relevant architectural decisions.

---

## Evolution & Roadmap

How this architecture will evolve.

---

**Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  
```

---

## SUMMARY Doc Template

**File**: `docs/SUMMARY-<FEATURE>-<DATE>.md` or `docs/<FEATURE>-SUMMARY-<DATE>.md`

**Example**: `docs/SUMMARY-LOGS-PANEL-2026-06-09.md`

```markdown
<!-- version: 1.0.0 -->
<!-- classification: SUMMARY -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-09 -->
<!-- status: ACTIVE -->

# Summary: [Feature/Project Name]

Executive summary and high-level status.

---

## Status: ✅ [Status]

What is the current state?

---

## What Was Accomplished

Quick bullet summary of deliverables.

---

## Key Metrics

| Metric | Value |
|--------|-------|
| — | — |

---

## Verification Results

Build, tests, code quality.

---

## Known Issues

Gaps, risks, follow-up items.

---

## Next Steps

What comes next and who should do it.

---

## References

Links to detailed documentation.

---

**Version**: 1.0.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-09  
**Status**: ACTIVE  
```

---

## PLAN Doc Template

```markdown
<!-- version: 1.0.0 -->
<!-- classification: PLAN -->
<!-- date: YYYY-MM-DD -->
<!-- last-updated: YYYY-MM-DD -->
<!-- feature: src/<paths this plan implements> -->
<!-- depends-on: PLAN-NN, ... -->
<!-- enables: PLAN-NN, ... -->

# PLAN-NN — [Feature Name]

## 1. Overview & Purpose
[What this builds and why; how it fits the larger effort.]

## 2. Interface Definitions
[Full TypeScript types, Zod schemas, function signatures.]

## 3. Mermaid Diagrams (all scenarios)
[Sequence/flow diagrams covering happy path + edge cases.]

## 4. Codebase Reality
| Assumed symbol | Real symbol (file:line) | Resolution |
|---|---|---|
| ... | ... | ... |

## 5. Contracts
IMPORTS: [symbol ← PLAN-NN / existing module]
EXPORTS: [symbol → consumers]

## 6. Edge Cases & Error Handling
[Table of case → handling.]

## 7. Test Cases
[Unit + integration test list, including a cross-spec integration test.]

## 8. Definition of Done
- [ ] Types compile; unit + integration tests green; ≥80% coverage
- [ ] No `any`; explicit return types
- [ ] Contracts resolve against sibling plans
```

---

## Quick Copy Commands

```bash
# Copy PLAN template
cp docs/documentation/DOCUMENTATION-TEMPLATES.md \
  docs/PLANS/PLAN-<NN>-<NAME>.md

# Copy FEATURE template
cp docs/documentation/DOCUMENTATION-TEMPLATES.md \
  docs/FEATURE-<NAME>-$(date +%Y-%m-%d).md

# Copy TESTING template
cp docs/documentation/DOCUMENTATION-TEMPLATES.md \
  docs/testing/TESTING-<NAME>-$(date +%Y-%m-%d).md

# Copy DESIGN template
cp docs/documentation/DOCUMENTATION-TEMPLATES.md \
  docs/reviews/DESIGN-<NAME>-$(date +%Y-%m-%d).md

# etc.
```

---

**Template Version**: 1.1.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-18  
**Status**: ACTIVE  

---

<a id="d5"></a>

## 5 · 2026-06-19 · Glossary — agentfactory-harness

Source: [GLOSSARY.md](GLOSSARY.md) · [[GLOSSARY]]  ·  [↑ Index](#index)


Centralized definitions for acronyms and key terms used across the documentation. Use this for
quick lookups instead of searching individual docs. Terms are grouped; within a group they are
alphabetical.

> **Format**: `Term` — expansion / definition. *See also* points to the doc that covers it.

---

## Product & concepts

| Term | Definition |
|---|---|
| **factory** | The CLI binary / app (`agentfactory-harness`). No-args launches the TUI; subcommands run CLI mode. |
| **ITUI** | *Interactive TUI* — the product concept: a mouse-driven, drag-and-drop ASCII canvas for building/running agent orchestration plans inside the terminal. |
| **TUI** | *Terminal User Interface* — a full-screen text UI rendered with ANSI escape codes. |
| **Three planes** | Agent (chat loop) · Orchestration (DAG) · Registry (auth/keys). *See* [[00-overview]]. |
| **Wave (0–5)** | Development phases: 0 scaffold · 1 session · 2 canvas · 3 orchestration · 3.5 multi-LLM · 4 terminal · 5 registry. |
| **DDD** | *Design-Driven Development* — the `docs/ddd/` design reference set. |
| **Nobel-laureate naming** | Chat sessions are auto-named after Nobel laureates (a deliberate delight). |

## Rendering & terminal

| Term | Definition |
|---|---|
| **cell-buffer** | The custom renderer grid (`Cell[][]`); produces minimal-diff ANSI output. *See* [[02-rendering]]. |
| **diff (frame)** | `CellBuffer.diff(prev)` — emits only changed cells as escape sequences. |
| **ANSI** | Escape-code standard for terminal control (colors, cursor, mouse). |
| **SGR** | *Select Graphic Rendition* — ANSI codes for color/bold/underline (`38;5;n`, `38;2;r;g;b`). |
| **CSI** | *Control Sequence Introducer* — `ESC[` prefix for most escape codes. |
| **OSC** | *Operating System Command* — `ESC]`. **OSC 8** = hyperlinks; **OSC 52** = clipboard copy. |
| **PTY** | *Pseudo-terminal* — the OS device backing the embedded Terminal panel (`node-pty`). |
| **VTScreen / VT** | Virtual terminal emulator that parses PTY output into a cell grid. *See* [[03-input-focus]]. |
| **alt screen** | The alternate terminal screen buffer (`?1049h`) the TUI runs in. |
| **bracketed paste** | Terminal mode (`?2004h`) that frames pasted text so it isn't treated as keystrokes. |
| **focus model** | `activeTab` is the single focus source; keys go to the active panel, mouse to the panel under the cursor. |

## Agent runtime & data

| Term | Definition |
|---|---|
| **agentLoop** | The streaming LLM loop: send → stream → tool dispatch → repeat (`maxTurns` cap). *See* [[05-core-data]]. |
| **LLM** | *Large Language Model*. |
| **LLMAdapter** | Provider abstraction; converts canonical history to a provider's wire format and yields `StreamChunk`s. |
| **StreamChunk** | Normalized streaming event (`text_delta`, `tool_start`, `usage`, …). |
| **AgentEvent** | Events `agentLoop` yields (`text_delta`, `tool_result`, `stats`, …). |
| **Provider** | An LLM backend (`anthropic`, `openai`, and compat: deepseek/ollama/…). |
| **tool / dispatch** | Registered capabilities (Bash/Read/Write/WebFetch) run via `dispatch(name, input)`. |
| **hook** | Lifecycle callback (`PreToolUse`, `PostToolUse`, `StepStart`, `StepComplete`) run as `.ai/hooks/*.sh`. |
| **Session** | Conversation history (Anthropic `MessageParam` format) + token count. |
| **rollout** | Append-only JSONL session persistence (`~/.config/agentfactory/sessions/`); resume = replay. |
| **ConfigStore** | Persistent provider key store (`~/.config/agentfactory/config.json`). |
| **maxTurns / maxTokens** | Agent-loop limits (default 20 turns / 2048 tokens). |

## Orchestration

| Term | Definition |
|---|---|
| **DAG** | *Directed Acyclic Graph* — the step dependency graph of a plan. |
| **af-plan.json** | The orchestration plan format (DAG of single-agent steps). *See* [[FEATURE-WAVE-3-DAG-ORCHESTRATION-2026-05-01]]. |
| **af-team.json** | The multi-agent team format (roles, providers, handoffs, logic ports). *Planned* — *see* `docs/PLANS/`. |
| **Executor** | Runs the DAG: toposort, ready-set scheduling, bounded concurrency, cascade-skip. |
| **toposort / readySet** | Graph utilities: topological order / steps whose deps are all complete. |
| **StepEvent / StepStatus** | Executor outputs (`step:start/done/error/skipped/plan:done`) and states. |
| **Planner** | The `factory plan new` interactive wizard. |
| **interpolation (`{{id}}`)** | A step prompt placeholder replaced with a dependency's output. |

## Multi-agent (planned — `docs/PLANS/`)

| Term | Definition |
|---|---|
| **handoff / HandoffPackage** | Structured relay of one agent's result to the next (summary/full/outputs modes). |
| **logic ports** | DAG flow gates: **AND/OR/XOR/NAND**. |
| **AgentAsk** | A running agent pausing to ask the user a question asynchronously. |
| **MessageBus / SharedMemory** | In-process agent-to-agent messaging / namespaced runtime KV store. |
| **TeamExecutor** | Settlement-driven multi-agent scheduler. |
| **ToolUseContext / buildTool** | Tool context object / factory (the PLAN-CORE integration seam). |

## Registry & ops

| Term | Definition |
|---|---|
| **Registry (agentfactory.dev)** | The remote service for auth and key management. |
| **device login** | OAuth device-code flow (user code + verify URL). |
| **doctor** | `factory doctor` — environment health checks (Node, keys, token, `.ai/`, `CLAUDE.md`). |
| **SSOT** | *Single Source of Truth*. |

## Documentation system

| Term | Definition |
|---|---|
| **taxonomy** | The doc classification system. *See* `DOCUMENTATION-TAXONOMY.md`. |
| **classification** | The doc type marker: FEATURE / TESTING / DESIGN / GAPS / ANALYSIS / CHANGE / STUDY / REVIEW / ARCHITECTURE / SUMMARY / **PLAN**. |
| **date / last-updated** | Header markers: `date` is the creation date (immutable); `last-updated` changes on every edit. |
| **registry (docs)** | `DOCUMENTATION-REGISTRY.md` — the index of all docs; search before creating, register after. |
| **document PLAN** | A spec-driven plan in `docs/PLANS/` (classification: PLAN), *pending* approval. |
| **approved plan** | A CLI-approved plan in `specs/docs/approvedPlans/` (dated `YYYY-MM-DD-<name>.md`). |
| **promotion** | Moving an approved `docs/PLANS/PLAN-*` into `specs/docs/approvedPlans/` with the dated name. *See* [[REVIEW-DOCUMENTATION-WORKFLOW-2026-06-18]]. |
| **MENTAL-MAP** | The DDD orientation skeleton ([[MENTAL-MAP]]) — read first. |

---

## Acronym quick-list

`ANSI` · `CSI` · `DAG` · `DDD` · `ITUI` · `LLM` · `OSC` · `PTY` · `SGR` · `SSOT` · `TUI` · `VT`

---

*Add a term whenever a new acronym or domain word appears in a doc. Keep definitions to one line;
link the canonical doc with **See also**.*

---

