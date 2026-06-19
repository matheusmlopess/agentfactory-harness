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

## Helpers

- `scripts/docs-compile.sh <folder|doc.md>` — (re)build the folder's **`MEMORIAL.md`**: one
  descriptive compendium of every doc in the folder, **date-ordered**, with an index + glossary.
  Deterministic rebuild → idempotent, picks up new docs, skips ones already in, re-sorts order.
  Run it whenever you add a doc.
- `scripts/docs-append.sh <doc.md> ["summary"]` — register a doc into its folder master
  `README.md` index (appends a dual markdown + `[[wikilink]]` entry, idempotent).

## Reference

- Glossary: [`GLOSSARY.md`](GLOSSARY.md) · [[GLOSSARY]]
- Marker rule: `.ai/rules/doc-before-commit.md` → "Header markers".
