<!-- version: 1.0.0 -->
<!-- classification: SUMMARY -->
<!-- date: 2026-06-19 -->
<!-- last-updated: 2026-06-19 -->
<!-- status: ACTIVE -->

# documentation/ — The Documentation System

The governance docs that define how all other documentation is classified, created, indexed,
and looked up. **Read in this order.**

## Summary

This folder is the reference for the doc system itself: the taxonomy (types + naming + markers),
copy-paste templates, the 6-step authoring workflow, the registry index, and the glossary.

## Contents (linear)

1. [`DOCUMENTATION-TAXONOMY.md`](DOCUMENTATION-TAXONOMY.md) · [[DOCUMENTATION-TAXONOMY]] — doc **types**, naming rules, header
   markers, storage locations, and the PLAN-doc lifecycle. *Read first.*
2. [`DOCUMENTATION-TEMPLATES.md`](DOCUMENTATION-TEMPLATES.md) · [[DOCUMENTATION-TEMPLATES]] — copy-paste templates with
   pre-filled headers for every type (incl. PLAN).
3. [`DOCUMENTATION-QUICK-START.md`](DOCUMENTATION-QUICK-START.md) · [[DOCUMENTATION-QUICK-START]] — the 6-step workflow:
   type → search registry → create/update → register → commit.
4. [`DOCUMENTATION-REGISTRY.md`](DOCUMENTATION-REGISTRY.md) · [[DOCUMENTATION-REGISTRY]] — the index of **all** docs; search
   here before creating, add a row after.
5. [`GLOSSARY.md`](GLOSSARY.md) · [[GLOSSARY]] — **Reference / Glossary**: centralized term & acronym lookups.

## Scripts — keeping the indexes & compendiums in sync

Two helper scripts (in `scripts/`) maintain the per-folder navigation so you never hand-edit a
master by hand.

### How it works (diagrams)

**Big picture — each folder gets two outputs:**

```
        docs/<folder>/                              produced by the two scripts
   ┌───────────────────────────┐
   │ <DOC-1>.md                 │──┐  docs-append.sh    ┌──────────────┐
   │ <DOC-2>.md                 │  ├───────────────────►│  README.md   │  ← short INDEX (one-liners)
   │ … (N source docs)          │  │  (1 link line/doc) └──────────────┘
   └───────────────────────────┘  │  docs-compile.sh    ┌──────────────┐
                                   └───────────────────►│ MEMORIAL.md  │  ← full COMPENDIUM
                                      (concatenate all,  │ index+glossary│    (auto, rebuilt)
                                       date-ordered)     │ + full bodies │
                                                         └──────────────┘
```

**The compile pipeline (full rebuild every run):**

```
 docs-compile.sh docs/<folder>
   │
   ├─ 1. COLLECT   every *.md except README.md & MEMORIAL.md
   ├─ 2. DATE      <!-- date: --> marker → git first-commit → date-in-filename → 9999-99-99
   ├─ 3. SORT      by (date, name), oldest → newest
   └─ 4. EMIT      header · # <FOLDER> — Memorial · ## Index · ## Glossary
                   then per doc:  ## N · <date> · <Title>
                                  Source: [file](file) · [[wiki]] · [↑ Index]
                                  <the doc's full body>
```

**Worked example** — folder with three docs (dates in their markers):

```
docs/changes/                          run docs-compile.sh ─►   MEMORIAL.md "Index"
├─ CHANGE-A.md  <!-- date 2026-02-10 -->                        1. Change B  2026-01-05
├─ CHANGE-B.md  <!-- date 2026-01-05 -->     ───────────►       2. Change A  2026-02-10
└─ CHANGE-C.md  <!-- date 2026-03-01 -->                        3. Change C  2026-03-01
                                                                (ordered by DATE, then full bodies follow)
```

Each index entry carries both `[Title](#dN)` (anchor jump) and `[[DOC]]` (Obsidian wikilink).

**The four guarantees (because it rebuilds, not appends):**

```
 (a) idempotent   run ×N            → identical file (same md5), no churn
 (b) auto-append  +new doc, recompile → it appears, slotted by its date
 (c) dedup        recompile ×N        → exactly ONE section per source file
 (d) re-order     change a doc's date → sections re-sort automatically
```

### `docs-compile.sh` — build the folder MEMORIAL (the big compendium)

```
scripts/docs-compile.sh <folder | path/to/DOC.md>
```

**What it does:** (re)builds `<folder>/MEMORIAL.md` — a single document that concatenates **every**
doc in the folder, **ordered by creation date**, with a clickable Index (markdown anchors +
`[[wikilinks]]`), a Glossary link, and each source's full content inline (each section links back
to its file). Creation date per doc = its `<!-- date -->` marker → git first-commit → date in the
filename.

**How it behaves (by design — a deterministic full rebuild):**

```
┌─ run scripts/docs-compile.sh docs/<folder> ──────────────────────────────┐
│  • idempotent     → re-running produces the same file (no duplicates)     │
│  • auto-append    → a newly created doc is picked up automatically        │
│  • dedup          → exactly one section per source file, never doubled    │
│  • re-order       → sections re-sorted by creation date every run         │
│  • skips          → README.md and MEMORIAL.md itself                      │
└───────────────────────────────────────────────────────────────────────────┘
```

So you don't "append the latest / check if it's already there / check the order" by hand — the
rebuild does all three. Pass a **folder** (`docs/reviews`) or **any doc path** (it compiles that
doc's parent folder).

### `docs-append.sh` — add one line to the folder README index (lightweight)

```
scripts/docs-append.sh <path/to/DOC.md> ["one-line summary"]
```

Appends a `- [file](file) · [[wikilink]] — summary` entry to the **same folder's `README.md`**
(before its `## Reference` section), idempotently, and bumps that README's `last-updated`. Use it
when you only want the short index updated, not the full MEMORIAL rebuild.

### Manual triggers — copy/paste

```bash
# After creating or editing a doc, rebuild that folder's compendium:
scripts/docs-compile.sh docs/reviews
# …or just point at the doc you touched:
scripts/docs-compile.sh docs/reviews/REVIEW-FOO-2026-06-19.md

# Rebuild every folder at once:
for d in documentation features testing reviews changes PLANS ddd; do
  scripts/docs-compile.sh "docs/$d"
done

# (Optional) only update the short README index for one doc:
scripts/docs-append.sh docs/reviews/REVIEW-FOO-2026-06-19.md "Why we did X"
```

The scripts are read-only except for the `MEMORIAL.md` / `README.md` they write, so they're safe
to re-run anytime. Commit the regenerated `MEMORIAL.md` alongside the doc that triggered it.

### How to direct Claude to run it (the supposed-to way)

This is wired into the doc workflow, so an agent should do it automatically — but you can also
ask explicitly. The canonical instruction:

> **After you create or edit any doc under `docs/<folder>/`, run
> `scripts/docs-compile.sh docs/<folder>` and commit the regenerated `MEMORIAL.md` with the doc.**

Drop-in prompts you can give Claude:

```text
"Add a REVIEW doc for X, then run scripts/docs-compile.sh on its folder and commit both."
"You changed docs/features/* — rebuild docs/features/MEMORIAL.md and include it in the commit."
"Regenerate all folder MEMORIALs (loop docs-compile over every docs subfolder) and commit."
```

The rule `.ai/rules/doc-before-commit.md` ("Header markers" / doc workflow) records this as a
required step, so agents following the rules will run `docs-compile.sh` before committing a doc
change without being asked.

### Reverting — if you no longer want the compendiums

The `MEMORIAL.md` files are **purely generated** — nothing else depends on them (the source docs
and folder `README.md` indexes stand on their own). Removing them is safe and non-destructive.

```bash
# Remove ONE folder's compendium:
scripts/docs-compile.sh --clean docs/reviews

# Remove ALL compendiums:
for d in documentation features testing reviews changes PLANS ddd; do
  scripts/docs-compile.sh --clean "docs/$d"
done
#   …or simply:  find docs -name MEMORIAL.md -delete
```

To **fully uninstall** the system (not just the output):

```
┌─ full revert checklist ──────────────────────────────────────────────────┐
│ 1. Delete the generated files:  find docs -name MEMORIAL.md -delete       │
│ 2. Remove the scripts:          git rm scripts/docs-compile.sh \          │
│                                        scripts/docs-append.sh             │
│ 3. Remove this "Scripts" section from docs/documentation/README.md and    │
│    the "📖 Full compendium" callouts from each folder README.             │
│ 4. Remove the "Regenerate the folder compendium" step from                │
│    .ai/rules/doc-before-commit.md                                         │
│ 5. Commit.                                                                 │
└───────────────────────────────────────────────────────────────────────────┘
```

Or, since everything is in git, revert the introducing commits wholesale:
`git revert <commit>` (the `docs: per-folder MEMORIAL …` and follow-up commits).

## Reference

- Glossary: [`GLOSSARY.md`](GLOSSARY.md) · [[GLOSSARY]]
- Marker rule: `.ai/rules/doc-before-commit.md` → "Header markers".
