# Rule 10 — Module Boundaries (enforced)

<!-- version: 2.0.0 -->
<!-- classification: DESIGN -->
<!-- date: 2026-08-26 -->
<!-- last-updated: 2026-08-26 -->

The codebase is compartmentalized into blocks that upgrade independently. After the
compartmentalization work the platform blocks are `@factory/*` **workspace packages** under
`packages/*`; the app **host + the six features** live in `src/`.

## Enforcement (two mechanisms)

1. **Package `dependencies`** govern the platform DAG. Each `@factory/*` package declares
   exactly what it may import; consumers use its `@factory/x/...` `exports`:

   ```
   @factory/orchestration  (leaf: zod)                     pure, TUI-free, reusable
   @factory/core           (leaf: @anthropic-ai/sdk, openai, zod)
   @factory/shared         -> @factory/core                (tracked soft spot)
   @factory/contracts      -> @factory/{orchestration, core, shared}  (type-only)
   @factory/registry       -> @factory/core
   root app (src/)         -> all of the above
   ```

2. **ESLint boundaries** (`eslint.config.js`, run by `npm run lint` + CI) govern `src/` — the
   host and features. The rule that lives here:
   - **A feature never imports another feature.** Cross-feature capability goes through the
     typed `ServiceRegistry` (`@factory/contracts`): a provider `set()`s a bridge; a consumer
     `get()`s it (returns `undefined` when absent -> degrade gracefully).
   - Features never import the host or harness.
   A violation fails `npm run lint`. Verified with planted `feature->feature` and
   `feature->host` imports.

## Adding things

- **New cross-feature capability** = add a key to `ServiceMap` in
  `packages/contracts/src/services.ts`, never a direct sibling import.
- **New feature** = a folder in `src/features/<id>/` returning a `Feature` (with a `manifest`);
  it may import `@factory/*` and its own files only.
- **New platform module** = add it to the owning package and export it from that package's
  `exports`; declare any new cross-package dependency in the package's `package.json`.

## Runtime toggles (Stage E)

A feature declares a `manifest { id, contract, provides?, consumes?, defaultEnabled? }`. The host
skips a feature whose `contract` major mismatches `CONTRACT_VERSION`, or that config disables
(`features.<id> = off`). Disabled features contribute no tab/command/binding and the app stays
healthy (the active tab falls back to the first loaded one).

See `docs/features/ARCHITECTURE-BLUEPRINT-2026-08-26.md` and
`specs/docs/approvedPlans/2026-08-26-compartmentalize-blocks.md`.
