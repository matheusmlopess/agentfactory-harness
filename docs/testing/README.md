<!-- version: 1.0.0 -->
<!-- classification: SUMMARY -->
<!-- date: 2026-06-19 -->
<!-- last-updated: 2026-08-26 -->
<!-- status: ACTIVE -->

# testing/ — Test Procedures

> 📖 **Full compendium:** [MEMORIAL.md](MEMORIAL.md) · [[MEMORIAL]] — every doc in this folder in one date-ordered descriptive document (index + glossary).

End-to-end and feature test guides: preconditions, manual steps, expected results, validation,
and failure indicators.

## Summary

Manual verification procedures for `factory`. Each guide pairs steps with expected results and a
correctness checklist.

## Contents (linear)

1. [`TESTING-FACTORY-E2E-2026-06-18.md`](TESTING-FACTORY-E2E-2026-06-18.md) · [[TESTING-FACTORY-E2E-2026-06-18]] — whole-app E2E:
   9 surfaces (doctor, chat, model picker, orchestration, terminal, config, logs, resume, copy)
   with happy/edge/failure paths + a correctness checklist.
2. [`TESTING-LOGS-PANEL-2026-06-09.md`](TESTING-LOGS-PANEL-2026-06-09.md) · [[TESTING-LOGS-PANEL-2026-06-09]] — Logs panel test
   procedures, cases, and failure checklist.

- [TESTING-CANVAS-SESSION-BINDING-2026-07-09.md](TESTING-CANVAS-SESSION-BINDING-2026-07-09.md) · [[TESTING-CANVAS-SESSION-BINDING-2026-07-09]] — E2E: wire-crash regression, binding states, click-through, bound runs

- [TESTING-UI-CONSOLIDATION-STUDIO-2026-07-07.md](TESTING-UI-CONSOLIDATION-STUDIO-2026-07-07.md) · [[TESTING-UI-CONSOLIDATION-STUDIO-2026-07-07]] — E2E: input/keymap, themes/profiles, widgets, studio authoring + run

- [TESTING-COMPARTMENTALIZE-2026-08-26.md](TESTING-COMPARTMENTALIZE-2026-08-26.md) · [[TESTING-COMPARTMENTALIZE-2026-08-26]] — How to verify the compartmentalization (Stages A–E) end-to-end: the `@factory/*` workspace

## Reference

Glossary: [`../documentation/GLOSSARY.md`](../documentation/GLOSSARY.md)
