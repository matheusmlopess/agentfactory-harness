<!-- version: 1.1.0 -->
<!-- classification: REVIEW -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-18 -->
# Documentation Taxonomy & Classification System

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
<!-- last-updated: 2026-06-17 -->
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

See: `docs/DOCUMENTATION-REGISTRY.md`

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
docs/FEATURE-LOGS-PANEL.md
docs/TESTING-LOGS-PANEL.md
docs/CHANGE-SUMMARY-LOGS-PANEL.md
docs/reviews/DESIGN-ANALYSIS-LOGS-PANEL.md
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
