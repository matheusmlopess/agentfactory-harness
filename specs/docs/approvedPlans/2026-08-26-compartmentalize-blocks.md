# Plan: Compartmentalize `factory` into independently-upgradeable blocks

<!-- version: 1.0.0 -->
<!-- classification: PLAN -->
<!-- date: 2026-08-26 -->
<!-- last-updated: 2026-08-26 -->

Approved plan for `feature/compartmentalize`. Turn the ddd/11 folder structure
(`features/*`, `shared/*`, `core/*`, `orchestration/*`) into real, enforced, swappable
blocks so any one can be upgraded/replaced/deleted without touching neighbours — like a
mechanic swapping a car part. Chosen depth: the full path through workspace packages +
runtime feature toggles.

## Context

The layering is already one-directional (features → shared/core/orchestration; nothing
imports up), but the boundaries are convention-only. The single cross-feature runtime seam
is an untyped `Map<string, unknown>` (`app.ts:57`, `features/types.ts:22`) with `as X` casts
at all 6 consumer sites (`app.ts:174/178`, `agents/index.ts:11/43`, `canvas/index.ts:37/118`)
and 3 `set` sites (`session:68`, `agents:51`, `canvas:180`). Two compile-time cross-feature
type edges exist (`agents/index.ts:3`, `canvas/index.ts:12` import `SessionBridge`) plus the
inline `satisfies import('../canvas/index.js').PlanEventSink` at `agents:51`. No ESLint, no
path aliases, no project references, no workspaces. `orchestration/` is pure (zod+node;
`studio-model` verified TUI-free). Soft spot: `shared → core/config` in 4 files.

## Stages (each independently shippable; seams before splits)

- **A — Contracts + typed registry (in-place):** new `src/contracts/{feature,services,index}.ts`.
  Move `Feature`/`FeatureCtx` + `SessionBridge`/`PlanBridge`/`PlanEventSink` there. Replace the
  untyped map with a typed `ServiceRegistry` keyed by a `ServiceMap`. All 6 casts and 3
  cross-feature edges go away; every feature compiles with zero sibling imports. Reversible.
- **B — Barrels + ESLint boundaries + CI:** root barrels for shared/core/orchestration/registry;
  `eslint-plugin-boundaries` flat config encoding the allow-matrix (features may not import
  siblings; only barrels importable); wire CI `lint` job to run eslint.
- **C — Isolated tests per block:** `vitest.workspace.ts` per-block projects + coverage;
  `contract.test.ts` per ServiceMap key + the Feature contract.
- **D — npm workspace packages:** extract leaves-first (contracts→orchestration→core→shared→
  features→host), acyclic DAG, `node-pty` scoped to `feature-terminal`, resolve the shared→core
  soft spot (B.3-clean). One package per PR.
- **E — Runtime toggles + contract versioning:** `FeatureManifest` + `CONTRACT_VERSION`;
  manifest-driven load with enable/disable + major-version gate; `doctor --features` report.

Recommended bail-out after A+B(+C) if the workspace split proves unnecessary.

## Full blueprint

The complete architecture blueprint — per-block I/O contracts (inputs, outputs, stable
connectors vs free internals, change-ripple), backward-compat policy, mermaid
software-architecture + communication/sequence + ERD diagrams, and the "test everything"
matrix — is reproduced from the working plan file and lands as
`docs/features/ARCHITECTURE-BLUEPRINT-2026-08-26.md` during the wrap-up stage.

## Verification (per stage)

- **A:** `tsc --noEmit` green with the registry typed; zero cross-feature `index` imports;
  existing full suite passes; `scripts/smoke-tui.sh` green (behaviour-preserving).
- **B:** a deliberate `feature→feature` import fails `npm run lint`; removing it passes.
- **C:** `vitest run --project orchestration` runs only that block; per-block coverage.
- **D:** `npm ci` links packages; `tsc -b` builds the DAG; a cycle fails the build; bin runs.
- **E:** `features.terminal=off` → tab absent, app healthy, no PTY; stale contract major
  skipped with a warning, not a crash.
