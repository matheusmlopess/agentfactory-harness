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

## Reference

- Glossary: [`GLOSSARY.md`](GLOSSARY.md) · [[GLOSSARY]]
- Marker rule: `.ai/rules/doc-before-commit.md` → "Header markers".
