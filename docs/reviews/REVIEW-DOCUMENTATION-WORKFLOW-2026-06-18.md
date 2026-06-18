<!-- version: 1.0.0 -->
<!-- classification: REVIEW -->
<!-- review-type: DOCUMENTATION -->
<!-- status: ACTIVE -->
<!-- date: 2026-06-18 -->
<!-- last-updated: 2026-06-18 -->

# Review: Documentation & Plan Workflow — How It Works (Every Scenario)

Explains the documentation taxonomy and the **two plan buckets** (`docs/PLANS/` document
plans vs `specs/docs/approvedPlans/` CLI-approved plans), with terminal-friendly tree
diagrams for every scenario.

---

## 1. Where everything lives (the map)

```
agentfactory-harness/
├── docs/
│   ├── DOCUMENTATION-TAXONOMY.md      ← defines all doc types + rules
│   ├── DOCUMENTATION-TEMPLATES.md     ← copy-paste header+body per type
│   ├── DOCUMENTATION-QUICK-START.md   ← the 6-step workflow
│   ├── DOCUMENTATION-REGISTRY.md      ← index of ALL docs (search before creating)
│   │
│   ├── PLANS/                         ← ① DOCUMENT PLANS (pending approval)
│   │   └── PLAN-<NN>-<NAME>.md           classification: PLAN
│   ├── features/   FEATURE-<NAME>-<DATE>.md
│   ├── testing/    TESTING-<NAME>-<DATE>.md
│   ├── reviews/    DESIGN- / GAPS- / ANALYSIS- / REVIEW-<NAME>-<DATE>.md
│   ├── studies/    STUDY-<NAME>-<DATE>.md
│   ├── architecture/ ARCHITECTURE-<NAME>-<DATE>.md
│   └── ddd/        (the design reference set)
│
├── specs/docs/approvedPlans/          ← ② CLI-APPROVED PLANS (final)
│   └── <YYYY-MM-DD>-<name>.md            dated format, NOT taxonomy-classified
│
└── .ai/rules/
    ├── doc-before-commit.md   ← header markers + "register before commit"
    └── approved-plans.md      ← governs specs/docs/approvedPlans/
```

**The key split:** two plan buckets with different formats and meanings.

```
            PLANS — two buckets, never mixed
            ───────────────────────────────
┌───────────────────────────┐     ┌───────────────────────────────┐
│ docs/PLANS/               │     │ specs/docs/approvedPlans/      │
│ PLAN-08-TEAM-EXECUTOR.md  │     │ 2026-06-09-wave-5-registry.md  │
│                           │     │                                │
│ • document plans          │     │ • CLI-approved plans           │
│ • from studies/sessions   │     │ • approved via plan workflow   │
│ • PENDING approval        │     │ • FINAL / dated                │
│ • classification: PLAN    │     │ • dated YYYY-MM-DD-<name>      │
└───────────────────────────┘     └───────────────────────────────┘
        the workshop                      the vault
```

---

## 2. Scenario A — Document PLAN lifecycle (study → approved)

```
STUDY / SESSION                                  the workshop                 the vault
─────────────                                    ───────────                  ─────────
 research, gaps,        author spec        ┌── docs/PLANS/ ──┐    approve     ┌ specs/docs/approvedPlans/ ┐
 ref repos      ──────────────────────►    │ PLAN-08-TEAM-   │  in a feature  │ 2026-07-01-team-         │
                                           │ EXECUTOR.md     │ ──────────────►│ executor.md              │
                                           │ classification: │  dev session   │ (dated CLI format,       │
                                           │   PLAN          │   + RENAME      │  no PLAN- prefix)        │
                                           └─────────────────┘                └──────────────────────────┘
                                              status: pending                    status: approved
```

```
Step-by-step:
 ┌─────────────────────────────────────────────────────────────────────┐
 │ 1. A study/session produces a spec                                   │
 │ 2. Write it as docs/PLANS/PLAN-NN-<NAME>.md  (classification: PLAN)   │
 │ 3. Register it in DOCUMENTATION-REGISTRY.md (PLAN section)            │
 │ 4. It stays in docs/PLANS/ while pending                             │
 │ 5. You APPROVE it in a feature-dev session                           │
 │ 6. MOVE it → specs/docs/approvedPlans/                               │
 │ 7. RENAME it → <YYYY-MM-DD>-<name>.md  (drop the PLAN- prefix)        │
 │ 8. From here it is governed by .ai/rules/approved-plans.md           │
 └─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Scenario B — CLI-approved plan (the other bucket)

Plans created through the `factory` CLI plan workflow go **straight to the vault** — they
never pass through `docs/PLANS/`.

```
 factory plan new
        │
        ▼
 ┌────────────────────┐        ┌────────────────────────────────────┐
 │ interactive wizard │ ─────► │ specs/docs/approvedPlans/           │
 │ (Planner.wizard)   │  write │ 2026-06-09-wave-5-registry-auth.md  │
 └────────────────────┘        │ (dated, governed by approved-plans) │
                               └────────────────────────────────────┘

 docs/PLANS/  is NOT involved here — these are already "approved".
```

Both entry points converge on the same vault by different routes:

```
            study/session spec ──► docs/PLANS/ ──(approve+rename)──┐
                                                                   ▼
                                                    specs/docs/approvedPlans/
                                                                   ▲
            factory plan new ─────────────(already approved)───────┘
```

---

## 4. Scenario C — Creating ANY new doc (taxonomy workflow)

Every non-plan doc (FEATURE, TESTING, DESIGN, REVIEW, …) follows the 6-step QUICK-START flow.

```
 START: "I need to document X"
   │
   ├─[1] Determine TYPE ───────────► FEATURE? TESTING? DESIGN? GAPS? … PLAN?
   │
   ├─[2] SEARCH the registry ───────► grep DOCUMENTATION-REGISTRY.md
   │        │
   │        ├── exists? ──► [3a] minor edit  ─► UPDATE existing
   │        │                                    └─ bump last-updated (+ version)
   │        │
   │        └── missing? ─► [3b] CREATE new
   │                          │
   ├─[4] Copy template ──────► TYPE-<NAME>-<DATE>.md  in the type's folder
   │        │                   with header:
   │        │                     <!-- version: 1.0.0 -->
   │        │                     <!-- classification: TYPE -->
   │        │                     <!-- date: <today> -->
   │        │                     <!-- last-updated: <today> -->
   │        │
   ├─[5] REGISTER ───────────► add a row to DOCUMENTATION-REGISTRY.md
   │
   └─[6] COMMIT ─────────────► git add <doc> DOCUMENTATION-REGISTRY.md
```

Type → location routing:

```
classification ──► folder ──► filename
─────────────────────────────────────────────────────────
FEATURE       ──► docs/ or docs/features/  ──► FEATURE-<NAME>-<DATE>.md
TESTING       ──► docs/testing/            ──► TESTING-<NAME>-<DATE>.md
DESIGN        ──► docs/reviews/            ──► DESIGN-<NAME>-<DATE>.md
GAPS          ──► docs/reviews/            ──► GAPS-<NAME>-<DATE>.md
ANALYSIS      ──► docs/reviews/            ──► ANALYSIS-<TYPE>-<NAME>-<DATE>.md
REVIEW        ──► docs/reviews/            ──► REVIEW-<ASPECT>-<DATE>.md
STUDY         ──► docs/studies/            ──► STUDY-<NAME>-<DATE>.md
ARCHITECTURE  ──► docs/architecture/       ──► ARCHITECTURE-<NAME>-<VER>-<DATE>.md
SUMMARY       ──► docs/                    ──► SUMMARY-<NAME>-<DATE>.md
PLAN          ──► docs/PLANS/              ──► PLAN-<NN>-<NAME>.md
```

---

## 5. Scenario D — Updating an existing doc (marker discipline)

The rule: **`date` is carved in stone; only `last-updated` moves.**

```
 DAY 1 (create)                         LATER (edit)
 ─────────────                          ───────────
 <!-- version: 1.0.0 -->                <!-- version: 1.1.0 -->   ← bump
 <!-- classification: DESIGN -->        <!-- classification: DESIGN -->
 <!-- date: 2026-06-18 -->     ════►    <!-- date: 2026-06-18 -->  ← FROZEN (never changes)
 <!-- last-updated: 2026-06-18 -->      <!-- last-updated: 2026-07-02 --> ← changes

 decision tree on edit:
   minor clarification ─► same file, bump last-updated + version
   major rewrite       ─► new file (new date), mark old "SUPERSEDED"
```

---

## 6. Scenario E — Where enforcement happens

```
 agent/dev creates or edits a .md
        │
        ▼
 ┌─ .ai/rules/doc-before-commit.md ──────────────────────────┐
 │  • require version/classification/date/last-updated       │
 │  • date set once; only last-updated changes               │
 │  • search registry before creating; register after        │
 └────────────────────────────────────────────────────────────┘
        │
        ├── is it a PLAN spec?  ──► docs/PLANS/  (classification: PLAN)
        ├── is it a CLI plan?   ──► specs/docs/approvedPlans/  (approved-plans.md)
        └── any other doc?      ──► taxonomy folder + registry row
        │
        ▼
   commit (doc + registry together)
```

---

## 7. One line per scenario

| Scenario | Flow |
|---|---|
| **A. Doc plan** | study → `docs/PLANS/PLAN-*` (pending) → approve+rename → `approvedPlans/<date>-name` |
| **B. CLI plan** | `factory plan new` → straight to `approvedPlans/<date>-name` |
| **C. New doc** | type → search registry → template → folder → register → commit |
| **D. Edit doc** | keep `date`, bump `last-updated` (+ version); big change → new dated doc |
| **E. Enforcement** | `doc-before-commit` gates markers + registration; two plan rules gate the two buckets |

---

## 8. Current state (2026-06-18)

```
docs/PLANS/  ← 16 multi-agent specs (PLAN-CORE, PLAN-00..13, PLAN-INDEX)  [pending]
                 ↓ (when you approve one for build)
specs/docs/approvedPlans/  ← 10 dated CLI-approved plans (Waves 0–5)      [final]
```

The 16 specs are document plans pending approval. Approving any for build moves+renames it
into `specs/docs/approvedPlans/` per Scenario A.

---

**References**: `docs/DOCUMENTATION-TAXONOMY.md` (PLAN type + lifecycle),
`docs/DOCUMENTATION-QUICK-START.md` (6-step flow), `.ai/rules/doc-before-commit.md`,
`.ai/rules/approved-plans.md`.
