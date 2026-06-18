<!-- version: 1.1.0 -->
<!-- classification: REVIEW -->
<!-- review-type: DOCUMENTATION -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-18 -->
<!-- status: ACTIVE -->

# Documentation Templates

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
cp docs/DOCUMENTATION-TEMPLATES.md \
  docs/PLANS/PLAN-<NN>-<NAME>.md

# Copy FEATURE template
cp docs/DOCUMENTATION-TEMPLATES.md \
  docs/FEATURE-<NAME>-$(date +%Y-%m-%d).md

# Copy TESTING template
cp docs/DOCUMENTATION-TEMPLATES.md \
  docs/testing/TESTING-<NAME>-$(date +%Y-%m-%d).md

# Copy DESIGN template
cp docs/DOCUMENTATION-TEMPLATES.md \
  docs/reviews/DESIGN-<NAME>-$(date +%Y-%m-%d).md

# etc.
```

---

**Template Version**: 1.1.0  
**Created**: 2026-06-09  
**Last Updated**: 2026-06-18  
**Status**: ACTIVE  
