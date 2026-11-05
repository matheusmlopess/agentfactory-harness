# Rule 10 — Module Boundaries (enforced)

<!-- version: 1.0.0 -->
<!-- classification: DESIGN -->
<!-- date: 2026-08-26 -->
<!-- last-updated: 2026-08-26 -->

The codebase is compartmentalized into blocks that upgrade independently. Boundaries are
**enforced by `eslint.config.js`** (`eslint-plugin-boundaries`), run by `npm run lint` and CI —
a violating import fails the build, not just review.

## The allow-matrix (who may import whom)

| from ↓ \ may import → | contracts | orchestration | core | shared | registry | sibling feature |
|---|---|---|---|---|---|---|
| **contracts**      | ✔ | ✔ (types) | ✔ (types) | ✔ (types) | – | – |
| **orchestration**  | – | ✔ | – | – | – | – |
| **core**           | ✔ | – | ✔ | – | – | – |
| **shared**         | ✔ | – | ✔ (soft spot) | ✔ | – | – |
| **registry**       | ✔ | – | ✔ | – | ✔ | – |
| **harness**        | ✔ | – | ✔ | – | ✔ | – |
| **feature**        | ✔ | ✔ | ✔ | ✔ | ✔ | ✖ **never** |
| **host**           | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

## Rules

1. **A feature never imports another feature.** Cross-feature capability goes through the
   typed `ServiceRegistry` (`src/contracts/services.ts`) — a provider `set()`s a bridge, a
   consumer `get()`s it (returns `undefined` when absent, so degrade gracefully).
2. **No layer imports "up."** `shared/core/orchestration/registry` never import `features` or
   the host. `orchestration` is pure (zod + node only).
3. **contracts is the neutral bolt-spec.** It may reference shared/core/orchestration *types*
   (erased); it holds the `Feature` contract + the service bridges + shared data shapes
   (`SessionMeta`, `SessionStats`).
4. **`shared → core/config`** is a tracked soft spot (4 files), allowed for now, to be removed
   when `@factory/shared` becomes a package (Stage D of the compartmentalization plan).

When you add or move a file, `boundaries/no-unknown-files` requires it to fall under an element
pattern in `eslint.config.js`. Adding a new cross-feature capability = add a key to `ServiceMap`
in contracts, never a direct sibling import.

See `specs/docs/approvedPlans/2026-08-26-compartmentalize-blocks.md` and (once written)
`docs/features/ARCHITECTURE-BLUEPRINT-2026-08-26.md` for the full blueprint.
