# Approved Plan — UI Consolidation + Standalone Orchestration Studio

<!-- version: 1.0.0 -->
<!-- classification: PLAN -->
<!-- date: 2026-07-04 -->
<!-- last-updated: 2026-07-04 -->

**Branch:** `feature/ui-consolidation` · **Worktree:** `~/repo/worktrees/ui-consolidation`
**Addresses:** `docs/ddd/09-gaps.md` (all 22 gaps), `docs/ddd/10-optimizations.md` (P0–P5), `docs/ddd/11-feature-isolation.md` (full Feature registry).

## Context

The DDD docs catalog verified problems in the TUI: 22 classified gaps (cross-panel inconsistencies, a 779-line `app.ts` god object, 4-way version drift, duplicated modals/lists/masking, color-only accessibility, no min-size handling), a prescriptive simplify/optimize/improve list with P0–P5 sequencing, and a lightweight `Feature` interface to end the "new panel touches 8–10 places" wiring problem.

**Approved scope decisions:**
- Scope = everything P0–P5 including the big features — but **P5 standalone**: the multi-agent kernel (PLAN-00–08: TeamSchema/TeamExecutor/MessageBus/SharedMemory/AskBroker) has no code in `src/` and stays out of scope. Canvas studio + Agents dashboard are built against the **existing** `PlanSchema`/`Executor`.
- Delivery = one approved plan, one worktree, phased commits with tests per phase.
- Min terminal size = settings-based **size profiles** (multiple sizes, compatibility check, user selection menu, too-small guard screen).
- Accessibility = **full pass** (glyph+text redundancy, high-contrast theme, reduced-motion toggle).

**Verified facts the plan builds on:**
- `src/app.ts` = 779 lines; input state machine `listenInput()` ≈ lines 537–778; Terminal raw-bypass 543–591; `panels[]` l.141 only routes session/canvas/agents — Config/Logs dispatched explicitly (645–663, 748–767).
- Version drift is 4-way: package.json `0.4.0`, `src/index.ts:5` `0.3.0`, `StatusBar.ts:5` `0.4.0`, `app.ts:88` logs `0.6.0`.
- 5 hand-rolled modals + ContextMenu (no Esc, no onMouse) + 6 separate list implementations; 2 masking schemes; 199 direct `Colors.*` call sites across 12 files; `accent === borderActive === 75`.
- `DEFAULT_MAX_TOKENS = 2048` at `agent-loop.ts:32`.
- No tests exist for app.ts, router.ts, layout.ts — a regression net comes first.
- Phase-6 feasibility: `executor.ts:31/87` has `{{depId}}` prompt interpolation; `PlanSchema` is a plain Zod object, so an optional `x-studio` extension field is additive.

## Phase order

```
P0 regression net + quick wins
P1 Overlay + ListBehavior
P2 semantic theme tokens + config-store settings
P3 InputController + HitTest extraction → registry seed (Logs feature)
P4 keymap + help overlay + a11y + size profiles + perf
P5 full Feature-registry migration + shared/ move + thin host
P6 standalone Studio + Agents team dashboard + NDJSON run
```

Two deliberate deviations from doc-11's framing: **InputController lands before the registry** (the Feature contract needs one unified input path to plug into; extraction is behaviour-preserving and characterization-tested), and **full feature migration waits for the keymap** (so `Feature.keybindings` has a target and features are touched once). New platform code is created under `src/tui/…`; the `shared/` move is one mechanical `git mv` commit in P5.

## Input-convention table (decisions — gaps 1–4)

| Concern | Convention |
|---|---|
| Wheel in text panes (Session transcript, Logs, Terminal scrollback) | viewport offset ×3 |
| Wheel in selection lists (Config, pickers, menus) | viewport offset ×1, never moves selection |
| Nav wrap vs clamp | clamp everywhere; single documented exception: Session slash-autocomplete keeps modulo wrap (shell-completion idiom) |
| Esc | closes any transient surface (modal/menu/palette) and cancels any mode (wiring/selection) |
| Click-outside | dismisses any transient |
| Copy | Ctrl+C = copy selection else quit; OSC 52; Ctrl+E toggles native selection (unchanged) |
| Vim hjkl | Logs-only until P4, where it becomes a `when:'logs'` keymap context |

## Phase 0 — Regression net + quick wins

- Characterization tests: `layout.test.ts` (exact rects at 24×80 / 40×120), `router.test.ts` (freeze today's dispatch contract), extend `terminal-bypass.test.ts` into a byte→action decision table covering every branch of app.ts 543–591.
- `src/tui/tab-bar.ts`: extract pure `tabBarHit()`/`tabLabelSpans()` from app.ts `tabAt`/`isExitBtn`/`renderTabBar`.
- Single VERSION — `src/core/version.ts` `getVersion()`: runtime read of `package.json` (works under `tsx` dev and `dist` build; try `../package.json` then `../../package.json`; cached). Fix all 4 sites.
- Masking — `src/core/config/mask.ts` `maskSecret(value, fieldType)` with ConfigPanel's `prefix+…▓▓▓▓` semantics; import overlay adopts it.
- Model-aware tokens — `src/core/llm/limits.ts` `maxOutputTokens(model)`: `claude-`→8192, `gpt-4o/gpt-5/o3`→16384, unknown→4096; `AgentLoopOptions` gains optional `maxTokens`; `DEFAULT_MAX_TOKENS` deleted.
- `scripts/smoke-tui.sh` tmux harness (grows per phase).

## Phase 1 — Overlay + ListBehavior widgets

- `src/tui/widgets/Overlay.ts` — size tiers `sm|md|lg` (46/56/64 wide; the 58-wide login folds into md), owns centering/clamping, border, title, footer hint, standard dismissal (Esc + click-outside). Hosts render content into `frame.inner`.
- ListBehavior = evolve `ScrollableList` in place with `ListOptions { visibleRows, wrap, wheel: 'viewport'|'selection', wheelStep }` + headless mode + `handleMouse`.
- Migration one commit each, by risk: Config import overlay → login → edit modal → Session new-session menu (wrap→clamp) → model picker (riskiest, async states). ContextMenu: keeps anchored frame but gains `escape` + `onMouse` + first test file. CommandPalette stays bespoke by decision. LogsPanel list stays bespoke but adopts wheel ×3.

## Phase 2 — Semantic theme tokens + focus affordance

- Rewrite `src/tui/renderer/theme.ts`: `Theme` interface with tokens `surface/surfacePanel/surfaceActive/border/focus/primary/text/textDim/textBright/success/warning/danger/info`; `themes: {default, 'high-contrast'}`; `setTheme()` mutates the exported `Colors` object — 199 call sites migrate in one mechanical rename commit (`bg→surface, bgPanel→surfacePanel, bgActive→surfaceActive, borderActive→focus, accent→primary, error→danger`), gated by tsc + suite + render-diff tests under both themes. Splits `focus` from `primary` (gap 18).
- Config-store settings: `ConfigFile` gains `settings: Record<string,string>` + `getSetting`/`setSetting`. Keys now: `theme`, `reducedMotion`; P4 adds `sizeProfile`, `layout.*Ratio`.
- `src/tui/renderer/motion.ts` `motionEnabled()`: spinners/countdowns render static `●` + text when off.
- Focus affordance: focused panel = `focus` border + inverse-video bold title (non-color redundancy) in `drawBorder`.

## Phase 3 — InputController + HitTest extraction; registry seed

- `src/tui/input/hit-test.ts`: `HitMap` (`set/clear/at`) rebuilt each render — replaces the four `statusBar*Col/Len` fields; registers `exit-btn`, `tab:<i>`, `statusbar:model`, `statusbar:tools`.
- `src/tui/tabs.ts` `TabEntry { id, title, panel(), rectFor(layout) }` — replaces `TABS` + `TAB_*` + `panels[]`; Config and Logs become first-class routed panels; `layout.logs` moves into `computeLayout`. `InputRouter` rewritten over `TabEntry[]` with visibility-aware mouse hit-scan.
- `src/tui/input/controller.ts` `InputController { attach(stdin), handleData(data) }` — the entire `listenInput` body moves out; Terminal raw-bypass moves verbatim; palette interception keeps both entry points. The P0 byte-table tests run against `handleData` directly and must pass unchanged before the old code is deleted.
- Registry seed: `src/features/types.ts` (`Feature`, `FeatureCtx`) + `src/features/registry.ts` + convert Logs to `src/features/logs/`; other five tabs stay legacy.

## Phase 4 — Keymap + help + a11y + responsive + perf

- `src/tui/input/keymap.ts` `KeyBindingDef { id, keys, when, description, run }` + `Keymap.handle(key, activeTab, textInputActive)`; the global if-chain becomes data; Logs `hjkl`/`c`/`a` become `when:'logs'` bindings; `?` opens help (suppressed in text input).
- `src/tui/widgets/HelpOverlay.ts`: Overlay `lg`, lists `keymap.list(activeTab)` grouped Global/tab, scrollable.
- A11y pass: glyph+text audit commit; ConfigPanel gains an "Interface" section (Theme / Reduced motion / Size profile) + palette commands.
- `src/tui/renderer/size-profiles.ts`: `SIZE_PROFILES` = compact 80×24 · standard 110×30 · wide 140×40; `activeProfile(store)`, `sizeCheck()`, `renderTooSmall()`. `App.render()` short-circuits to the guard screen (input still works) at startup and on resize.
- Adjustable dividers: `computeLayout(rows, cols, prefs?)` with clamped `sessionRatio`/`canvasRatio`; HitMap `divider:v`/`divider:h`; drag updates, release persists.
- Bucket-B perf: motion-event coalescing, `src/core/llm/model-cache.ts` `cachedListModels` (TTL 5 min), dirty-region rendering (overlays force full frame as documented fallback; parity test).

## Phase 5 — Full Feature registry migration

Order: Config → Terminal → Session → Canvas → Agents (Logs done in P3), one commit each. Session exposes a `sessionBridge` service via a `services` registry on `FeatureCtx`. Then the `shared/` move as one mechanical `git mv` commit (`tui/renderer→shared/renderer`, `tui/input→shared/input`, remaining widgets→`shared/widgets`, `Panel.ts→shared/panel.ts`) + import rewrite + project-index update. Thin host: `app.ts` ends ~150–200 lines. Acceptance test: registering a dummy feature adds a tab + palette command + keybinding with zero app.ts edits.

## Phase 6 — Standalone P5: Studio + team dashboard + NDJSON

- `src/orchestration/studio-model.ts` (pure — no TUI imports, enforced by test): `StudioNode`, `StudioEdge { kind: 'dependency'|'handoff', payload? }`, `studioToPlan`/`planToStudio`/`validateStudio` (reuses `detectCycles`)/`deriveView`.
- Serialization: output stays a valid `PlanSchema` doc the existing executor runs unchanged — all edges become `dependsOn`; handoff payloads ride the existing `{{depId}}` interpolation (append `Input from <from>:\n{{<from>}}` to target prompt when absent); optional additive `x-studio` schema field carries layout + edge kinds + forward-compat fields for lossless round-trip.
- Canvas ownership inversion: `StudioModel` becomes source of truth; `CanvasState.blocks/wires` become a `deriveView` render cache; `syncFromPlan`/`getState` signatures preserved. Adds click-to-select, typed-connector ContextMenu (handoff `═` + `[H]` label), `Configure…` replaces the no-op "Open session", real "Add agent" opens the inspector, `ctrl+s` saves `af-plan.json`, `b` toggles Build⇄Run, `applyStepEvent` extended with `pending ◎`/`skipped ⊘`.
- `Toolbox.ts` (left rail, agent templates, placement-mode drop → inspector) + `NodeInspector.ts` (Overlay `md`; name/agent/provider/model/prompt/timeout; inline validation).
- AgentsPanel team dashboard: `mode: 'sessions'|'team'` (sessions unchanged incl. Nobel tooltip, suppressed in team mode); badges `◎ ● ✓ ✗ ⊘ ○` with text labels; two-column (step list | detail + event log) fed by `onPlanEvent(StepEvent)`; stacks single-column below `standard` width.
- NDJSON: `factory run --json` emits one JSON object per `StepEvent` + ISO `ts` on stdout (human lines → stderr); exit 1 on any step error.

## Verification

- Per commit: `npx tsc --noEmit` + `npm test`; ≥80% coverage on new logic.
- TUI smoke: `scripts/smoke-tui.sh` using tmux (`new-session -d -x 120 -y 40` → `send-keys` → `capture-pane -p` → grep).
- P3 gate: byte-level decision-table tests pass unchanged against extracted `handleData` before `listenInput` is deleted.
- P6 end-to-end: build a 3-node plan with one handoff in the TUI → Ctrl+S → `factory run --json` executes it → reopen: graph round-trips; forced error shows cascade `⊘ skipped`.

## Risks / rollback

| Risk | Mitigation |
|---|---|
| Terminal raw-bypass regression (P3) | code moved verbatim; P0 byte-table is the contract; one revert unit |
| Mouse routing change (Config/Logs now routed) | visibility-aware scan reproduces `panelTabAt`; integration test |
| 199-site theme rename (P2) | mechanical single commit, tsc + render-diff gates |
| Modal pixel drift (P1, login 58→56) | one modal per commit + render-diff tests |
| Dirty-region artifacts under overlays (P4) | parity test; fallback: overlay ⇒ full frame |
| `shared/` move breakage (P5) | pure git mv + rewrite, zero logic changes, tsc gate |
| Canvas inversion vs existing tests (P6) | public signatures preserved; old tests must pass first |

Shippable checkpoints: P0/P1/P2 fully independent; P3 alone; P4 needs P2+P3; P5 needs P3+P4; P6 slices independently mergeable after P1+P3.
