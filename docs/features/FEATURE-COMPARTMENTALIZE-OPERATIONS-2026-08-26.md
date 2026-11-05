# FEATURE — Compartmentalized Blocks: Operational Guide

<!-- version: 1.0.0 -->
<!-- classification: FEATURE -->
<!-- date: 2026-08-26 -->
<!-- last-updated: 2026-08-26 -->

Operator/developer guide for the compartmentalization work (Stages A–E): the `@factory/*`
workspace packages, the typed service registry, enforced boundaries, and runtime feature
toggles. Companions: `ARCHITECTURE-BLUEPRINT-2026-08-26.md` (contracts + diagrams),
`docs/testing/TESTING-COMPARTMENTALIZE-2026-08-26.md`, `.ai/rules/module-boundaries.md`.

> **Scope note.** This system is a single local TUI binary (`factory`). It has **no** Docker /
> Compose / Ansible infrastructure and **no** "operator console / route-separated" service —
> those sections of the standard checklist do not apply here.

---

## 1. What compartmentalization gives you

```
┌ The car-mechanic model ─────────────────────────────────────────────────────┐
│  Platform libraries = @factory/* workspace PACKAGES (packages/*)             │
│    orchestration · core · shared · contracts · registry                      │
│  App = root package (src/): the host + the six features                      │
│                                                                              │
│  Swap/upgrade one block behind its contract → neighbours untouched, and the  │
│  build (lint + tsc + package deps) proves it.                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

Two enforcement mechanisms:

| Boundary | Enforced by | Fails how |
|---|---|---|
| Platform DAG (which package may use which) | each `package.json` `dependencies` + `exports` | undeclared/illegal edge = missing symbol / review |
| Feature isolation (no feature imports a sibling; features ↛ host/harness) | ESLint boundaries (`eslint.config.js`) | `npm run lint` error, CI red |
| Cross-feature capability | typed `ServiceRegistry` in `@factory/contracts` | compile error on wrong key/shape |

---

## 2. Developer workflows (the mechanic at work)

### 2.1 Upgrade a block's internals (happy path)

```
Goal: rewrite the canvas renderer without touching any other block.
1. Edit files under src/features/canvas/ only.
2. npm run typecheck   # tsc across the workspace
3. npx vitest run --project features   # or the full: npm test
4. npm run lint        # boundaries: proves canvas imports no sibling feature
5. ./scripts/smoke-tui.sh
Guarantee: canvas's public surface = the Feature it returns + the 'plan' service key.
As long as those are unchanged, no consumer can have depended on its internals.
```

### 2.2 Add a new feature/tab

```
1. Create src/features/foo/{index.ts,panel.ts}; index returns a Feature with a manifest:
     manifest: { id: 'foo', contract: CONTRACT_VERSION }
2. Register it: one line in src/app.ts initFeatures() candidates[].
3. It may import @factory/{contracts,shared,core,orchestration,registry} + its own files.
Guarantee: ESLint fails the build if foo imports another feature; the host builds its tab,
palette entry, keymap, and F-key from the Feature — no other host edits.
```

### 2.3 Add a cross-feature capability

```
Never import the other feature. Instead:
1. Add a key to ServiceMap in packages/contracts/src/services.ts, e.g. 'metrics': MetricsBridge.
2. Provider: ctx.services.set('metrics', bridge)   # typed; set() dedupes.
3. Consumer: const m = ctx.services.get('metrics') # MetricsBridge | undefined — handle undefined.
```

### 2.4 Upgrade a platform library (e.g. @factory/core)

```
1. Edit packages/core/src/*.
2. If a PUBLIC (exports-reachable) type changed, tsc flags every dependent package precisely.
3. Bump packages/core/package.json version if you version independently.
Guarantee: core never imports "up"; consumers use @factory/core/<subpath>.js.
```

### 2.5 Reuse the pure engine elsewhere (scenario: a web renderer)

```
@factory/orchestration is pure (zod + node; no TUI). A separate app can:
   import { Executor } from '@factory/orchestration/executor.js'
   import { studioToPlan, planToStudio } from '@factory/orchestration/studio-model.js'
and drive plan runs with no TUI dependency. Verified by the purity test.
```

---

## 3. Operator workflow — runtime feature toggles (Stage E)

Features are enabled/disabled via the config file, no rebuild:

```
~/.config/agentfactory/config.json
{
  "keys": {},
  "urls": {},
  "settings": {
    "features.terminal": "off",     # hide the Terminal tab; node-pty not loaded
    "features.logs":     "off"      # hide the Logs tab
  }
}
```

Values per `features.<id>`: `off`/`false` disable · `on`/`true` force-enable · absent = the
feature's `defaultEnabled` (true). Feature ids: `session`, `orchestration`, `agents`,
`terminal`, `config`, `logs`.

```
┌ Before (all on) ──────────────┐   ┌ After features.terminal=off ──────────┐
│ Session Orchestration Agents  │   │ Session Orchestration Agents Config   │
│ Terminal Config Logs   ✕Quit  │   │ Logs                          ✕Quit   │
└────────────────────────────────┘   └────────────────────────────────────────┘
Tab bar, palette "Switch to…", F-keys, and Tab-cycle all omit the disabled tab.
The active tab falls back to the first loaded tab — never a blank/phantom tab.
```

**Contract versioning:** each feature declares the `contract` version it was built against. If
its major differs from the host's `CONTRACT_VERSION`, the host **skips it with a warning** (it
does not crash). This is the guard for a stale/incompatible feature package.

---

## 4. Edge cases & failure modes (with recovery)

| Situation | Behaviour | Recovery |
|---|---|---|
| A consumed service provider is disabled (e.g. agents off, canvas consumes `plan-events`) | `services.get()` returns `undefined`; consumer no-ops (canvas still runs its plan, just no dashboard) | none needed — graceful by design (compiler forces the `undefined` branch) |
| Disable the active tab's feature at startup | active tab falls back to the first loaded tab | none — automatic |
| Disable **all** features | tab list empty; app renders chrome only | re-enable at least one in config |
| Feature stamped with an incompatible contract major | skipped + `log.warn('skipping feature: incompatible contract')`; app healthy | rebuild the feature against the host contract, or bump its manifest |
| A developer adds `import '../session/…'` in another feature | `npm run lint` fails: "File is of type 'feature'… Dependency is of type 'feature'" | route through a `ServiceMap` key instead |
| A block reaches a platform internal not in a package's `exports` | resolution/type error at build | export it from that package's `exports`, or use a declared subpath |
| `getVersion()` can't find the root package.json (deep nesting) | returns `'0.0.0'` (never throws) | fixed to walk up 4 levels; if it recurs, extend the candidate list in `packages/core/src/version.ts` |
| Native `node-pty` fails to build | only the Terminal feature is affected; other tabs fine (`[PTY unavailable]`) | fix the toolchain, or `features.terminal=off` |
| `npm ci` fails on CI after adding a dep | lockfile out of sync (sandbox has `package-lock=false`) | `npm install --package-lock=true`; commit the regenerated `package-lock.json` |

---

## 5. Validation reference

```
npm run lint        # ESLint boundaries (feature-sibling ban) + it also gates CI
npm run typecheck   # tsc --noEmit across src + packages
npm test            # vitest — 453 tests; per-block: vitest run --project <block>
npm run build       # tsup bundles the @factory/* graph into the factory bin
./scripts/smoke-tui.sh   # real TUI in tmux (hermetic HOME): 13 checks
```

A change to a **connector** (a package's `exports` surface, the `Feature`/`FeatureCtx` shape, or
a `ServiceMap` key) additionally requires: its contract test, all consumers updated in the same
PR, and a `CONTRACT_VERSION` major bump if the `Feature`/service surface broke.

---

## 6. Where things live

```
packages/orchestration/   @factory/orchestration  (zod)                pure engine
packages/core/            @factory/core            (sdk, openai, zod)
packages/shared/          @factory/shared          (-> @factory/core)
packages/contracts/       @factory/contracts       (-> orch, core, shared)
packages/registry/        @factory/registry        (-> @factory/core)
src/app.ts, src/cli.ts    the host (bin: factory)
src/features/<id>/        the six features (governed by ESLint in src/)
tsconfig.base.json        shared compilerOptions (each package extends it)
eslint.config.js          the feature-sibling boundary rule
~/.config/agentfactory/config.json   settings.features.<id> toggles
```
