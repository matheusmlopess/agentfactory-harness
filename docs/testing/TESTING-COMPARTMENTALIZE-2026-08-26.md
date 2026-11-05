# TESTING — Compartmentalized Blocks: End-to-End Guide

<!-- version: 1.0.0 -->
<!-- classification: TESTING -->
<!-- date: 2026-08-26 -->
<!-- last-updated: 2026-08-26 -->

How to verify the compartmentalization (Stages A–E) end-to-end: the `@factory/*` workspace
packages, the typed service registry, the enforced feature-sibling boundary, and runtime
feature toggles + contract versioning.

> No infrastructure (Docker/Compose/Ansible) and no routed "operator console" exist in this
> repo, so those verification steps do not apply.

## 0. Preconditions

```
┌ Required ────────────────────────────────────────────────────────────────┐
│ • Node ≥ 20; a clean checkout of feature/compartmentalize-packages        │
│ • The sandbox npm has package-lock=false — regenerate the lock with       │
│   `npm install --package-lock=true` before a `npm ci` check               │
│ • A real terminal ≥ 120×40 + tmux for the TUI/toggle steps                 │
├ Optional ────────────────────────────────────────────────────────────────┤
│ • ANTHROPIC_API_KEY for a real plan run (not needed — error/skip paths     │
│   are part of the test)                                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

## 1. Automated gates (run first)

| # | Command | Expected |
|---|---|---|
| 1 | `npm ci` (after `npm install --package-lock=true`) | installs; symlinks `node_modules/@factory/*` → `packages/*` |
| 2 | `npm run typecheck` | no output (tsc across `src` + `packages`) |
| 3 | `npm run lint` | no output; exit 0 (ESLint boundaries) |
| 4 | `npm test` | **453 passed** |
| 5 | `npm run build` | ESM + DTS "Build success" (tsup bundles the `@factory/*` graph into the bin) |
| 6 | `./scripts/smoke-tui.sh` | `smoke-tui: all checks passed` (13 checks, hermetic HOME) |

Failure indicators: any tsc/eslint output; a test count ≠ 453; `npm ci` erroring on a lockfile
mismatch (regenerate the lock, §0); a build error resolving `@factory/*` (check the package's
`exports`).

## 2. Workspace packages resolve

| Step | Expected | Validates |
|---|---|---|
| `ls -la node_modules/@factory/` | 5 symlinks → `../../packages/{orchestration,core,shared,contracts,registry}` | workspaces linked |
| `grep -rn "@factory/orchestration" src/features/canvas/index.ts` | subpath imports like `@factory/orchestration/schema.js` | cross-package import style |
| `npx vitest run --project orchestration` | 56 tests, only the orchestration package | per-block isolation |
| `node -e "…getVersion()"` via tsx (see below) | `0.4.0` | version resolution from the package path |

```
npx tsx -e "import('@factory/core/version.js').then(m => console.log(m.getVersion()))"
# → 0.4.0   (walks up to the root agentfactory-harness package.json)
```

## 3. The service registry is typed (contract test)

| Step | Expected |
|---|---|
| `npx vitest run --project contracts` | 11 tests (registry + manifest) pass |
| Read `packages/contracts/src/services.test.ts` | `get()` returns `undefined` for an unregistered key; `set()` throws on double-registration; keys are independent |

## 4. The feature-sibling boundary is enforced (the key guarantee)

```
# Plant a cross-feature import; lint MUST fail:
printf "import type { SessionBridge } from '../session/index.js'\n" | cat - src/features/logs/index.ts > /tmp/x && mv /tmp/x src/features/logs/index.ts
npm run lint    # EXPECT: error "File is of type 'feature' with feature 'logs'.
                #          Dependency is of type 'feature' with feature 'session'"
git checkout src/features/logs/index.ts

# Plant a feature→host import; lint MUST fail:
printf "import { App } from '../../app.js'\n" | cat - src/features/logs/index.ts > /tmp/x && mv /tmp/x src/features/logs/index.ts
npm run lint    # EXPECT: error "Dependency is of type 'host'"
git checkout src/features/logs/index.ts
```

Expected: both planted imports fail `npm run lint`; after `git checkout`, lint passes. This is
the machine proof that a feature cannot reach into a neighbour or the host.

## 5. Runtime feature toggle (Stage E) — end-to-end

```
SMOKE_HOME=$(mktemp -d); mkdir -p "$SMOKE_HOME/.config/agentfactory"
cat > "$SMOKE_HOME/.config/agentfactory/config.json" <<'JSON'
{ "keys": {}, "urls": {}, "settings": { "features.terminal": "off" } }
JSON
tmux new-session -d -s tgl -x 120 -y 40 "env HOME=$SMOKE_HOME npx tsx src/index.ts"
sleep 8
tmux capture-pane -pt tgl | head -1     # tab bar
tmux send-keys -t tgl F5; sleep 1
tmux capture-pane -pt tgl | grep -q "API Providers" && echo "Config works"
tmux send-keys -t tgl C-q; tmux kill-session -t tgl; rm -rf "$SMOKE_HOME"
```

Expected: the tab bar shows `Session Orchestration Agents Config Logs` (**no Terminal**); F5
opens Config; the app is fully responsive; `node-pty` is never loaded. Common failure
indicator: Terminal still present → the setting key is wrong (must be `features.terminal`) or
the manifest gate isn't wired.

## 6. Contract-version gate (unit-level)

| Step | Expected |
|---|---|
| Read `packages/contracts/src/manifest.test.ts` | `isContractCompatible('2.0.0','1.0.0') === false`; same-major true; `isFeatureEnabled` honours off/on/default |
| Conceptual e2e | a feature whose `manifest.contract` major ≠ host `CONTRACT_VERSION` is skipped with `log.warn`, app stays healthy (mirror the toggle test with a stamped-old manifest) |

## 7. Correctness checklist

```
┌ The implementation is correct when ALL hold ──────────────────────────────┐
│ □ §1 gates green (ci / typecheck / lint / 453 tests / build / smoke)      │
│ □ node_modules/@factory/* symlinks resolve; getVersion() = 0.4.0          │
│ □ per-block vitest projects run in isolation                              │
│ □ a planted feature→feature AND feature→host import both FAIL lint        │
│ □ features.terminal=off → Terminal tab absent, app healthy, no PTY        │
│ □ ServiceRegistry get() typed (undefined for absent key); set() dedupes   │
│ □ contract-version gate: incompatible major skipped, not crashed          │
│ □ studio-model stays pure (no shared/features imports) — purity test      │
└────────────────────────────────────────────────────────────────────────────┘
```

## 8. Common failure indicators → first move

| Indicator | Likely cause | First move |
|---|---|---|
| `npm ci` fails: lockfile mismatch | sandbox `package-lock=false`; lock stale | `npm install --package-lock=true`; commit lock |
| build can't resolve `@factory/x/y.js` | missing from that package's `exports` | add subpath to `exports` / use an exported path |
| lint passes when it "should" fail on a cross-package edge | that edge is now governed by package deps, not ESLint (by design) | check the package.json dependency instead |
| Terminal tab present despite `off` | wrong setting key or config not loaded | key is `features.terminal`; check `$HOME/.config/agentfactory/config.json` |
| `getVersion()` returns `0.0.0` | module nested deeper than the candidate list | extend the upward search in `packages/core/src/version.ts` |
| smoke fails only the startup checks | tsx cold-start slower than the poll | re-run; the script polls up to 60s |
```
