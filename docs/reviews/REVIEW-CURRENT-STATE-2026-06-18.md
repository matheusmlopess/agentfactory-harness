# Consolidated Implementation Review — `factory` (Waves 0–5 + UI Consolidation)

<!-- version: 2.1.0 -->
<!-- classification: REVIEW -->
<!-- date: 2026-06-18 -->
<!-- last-updated: 2026-07-09 -->
<!-- Scope: the IMPLEMENTED app (Waves 0–5 + feature/ui-consolidation). -->
<!-- Companion: docs/ddd/ (design reference), docs/testing/TESTING-UI-CONSOLIDATION-STUDIO-2026-07-07.md + TESTING-CANVAS-SESSION-BINDING-2026-07-09.md (test guides), docs/changes/CHANGE-UI-CONSOLIDATION-STUDIO-2026-07-07.md + CHANGE-CANVAS-SESSION-BINDING-2026-07-09.md (deltas). -->

> **What this is:** a design analysis of the implemented system — reasoning & trade-offs,
> assumptions, gaps/risks, missing scenarios, and enhancements. It does **not** cover
> infrastructure (none: no Docker/Compose/Ansible files exist in this repo) or any
> "operator console / route-separated workflow system" (none: this is a single-binary
> CLI/TUI, not a routed service). If infra definitions are ever added, this review must
> gain an infra-drift section (compose/services/env vars vs code) and the PR checklist
> in §6 must be extended accordingly.
>
> **v2.0.0 (2026-07-07):** updated after `feature/ui-consolidation` implemented
> ddd/09–11 in full plus standalone PLAN-13/PLAN-10. Resolved risks are struck through
> in §3; §1/§2/§4–§7 revised to the current code.
>
> **v2.1.0 (2026-07-09):** updated for the canvas-session-binding work
> (`specs/docs/approvedPlans/2026-07-08-canvas-session-binding-and-wire-fix.md`):
> the `routeWire` infinite-loop crash (found live, reproduced, fixed), the per-panel
> render guard, session identity (rollout id), and canvas↔agents↔sessions binding.
> *(v2.1)* rows below carry the new analysis; R16–R19 are the new risks.

---

## 1. Design reasoning & trade-offs

| Decision | Reasoning | Trade-off accepted |
|---|---|---|
| **No UI framework; custom cell-buffer renderer** | Full control of ANSI output, zero framework overhead, one self-contained binary | Must hand-build diffing, layout, focus, widgets; more code to own |
| **Minimal-diff frame output** (`CellBuffer.diff`) | Emit only changed cells → tiny writes, smooth streaming | Diff is O(cells) per frame; no region-level skip yet |
| **Event-driven render** (`scheduleRender` + `setImmediate`) | Paint only when state changes; coalesce bursts into one frame | Two render paths (scheduled vs synchronous) to reason about |
| **Anthropic `MessageParam` as canonical history** | One internal format; adapters convert outward | OpenAI adapter must translate every turn (tool_calls, tool role) |
| **`activeTab` is the single focus source** | Simple, predictable; one place decides routing | Couples focus to tabs; non-tab focus (overlays) handled ad hoc |
| **Shell-script hooks** (`.ai/hooks/*.sh`, `{continue}` only) | Language-agnostic, no in-proc coupling | No return-data channel (cannot inject context — blocks multi-agent needs) |
| **Local-first files** (`~/.config/agentfactory/…`) | No server dependency; works offline; transparent | No sync/multi-device; secrets sit in a plaintext JSON (mode-guarded) |
| **`agent` tool not registered interactively** | Its Zod schema would reject the model's free-form input in the shared registry | No nested-agent tool in chat; orchestration is the path instead |
| **Tools receive only parsed input (no context)** | Simple tool contract | Blocks team features (message/memory/ask) — addressed by PR #23 `ToolUseContext` |
| **Raw-byte bypass for the Terminal tab** | Real shell fidelity (keys reach PTY unmodified) | A third input path; only a few keys intercepted |
| **Nobel-laureate session naming + tooltip** | Memorable identity, light delight | Cosmetic coupling to `nobel.ts`; not functional |
| *(v2)* **Feature registry over package split** (ddd/11 "lightweight" option) | Each tab = one folder/branch; host shrinks to a loader; no build tooling changes | Cross-feature needs go through an untyped `services` Map (string keys, casts at the consumer) |
| *(v2)* **InputController extracted before the registry** (inverted from ddd/11's framing) | The Feature contract needs ONE input path to plug into; extraction was behavior-preserving under a byte-level test net | Two commits touched the same code region back-to-back |
| *(v2)* **Studio serializes to af-plan.json + additive `x-studio`** (not a new TeamDef file) | Files stay runnable by the untouched executor/CLI; lossless round-trip; zero migration | Handoff payloads (`summary`/`full`) are recorded but semantically identical at run time until the kernel lands |
| *(v2)* **Handoffs ride `{{depId}}` interpolation** (scaffold appended to the target prompt) | Reuses the executor's existing mechanism; no schema change to Step | The scaffold visibly edits the user's prompt text (stable across round-trips, but present) |
| *(v2)* **`Colors` mutated in place by `setTheme()`** | 199 call sites keep `Colors.token` syntax; themes apply on next frame with no plumbing | A mutable module-level singleton; tests must reset (`afterEach(setTheme('default'))`) |
| *(v2)* **Runtime `getVersion()` reads package.json** (not tsup define / codegen) | One mechanism for `tsx` dev AND `dist` builds; nothing to regenerate | A file read on first call (cached; name-guarded against picking up a stranger's package.json) |
| *(v2)* **Dirty-region rendering deferred** | `CellBuffer.diff` already bounds terminal writes to changed cells; repaint cost is negligible at TUI scale | Full-buffer repaint each frame stays O(cells) CPU |
| *(v2.1)* **Session identity = rollout id** (not a new UUID) | The rollout file path is already unique, persistent, and directly resumable; zero new id infrastructure | A resumed session gets a NEW id (new rollout file) — bindings must self-heal by rebinding, and plan files saved pre-resume go stale until re-saved |
| *(v2.1)* **Canvas agents are REAL sessions** (not synthetic Agents-list rows) | The Agents list is already a pure projection of `metas()` — real records mean zero merge logic, and every row is click-openable; run output lands in an inspectable transcript | Creating a box has a side effect outside the canvas (a session record + rollout file); deleting the box intentionally does NOT delete it |
| *(v2.1)* **Binding persisted in `x-studio.sessions`** (nodeId → sessionId) | Stays additive — executor/CLI ignore it, legacy files parse via `.default({})`; `studio-model.ts` stays TUI-free (opaque string) | Session liveness is undecidable at parse time; every consumer of a binding must run the open-time resolution ladder |
| *(v2.1)* **`CanvasSessionActions` injected, not imported** | Canvas panel stays decoupled from the session feature (testable with a fake; headless works without a bridge) | One more hand-rolled seam on top of the untyped services map (R11 grows by one surface) |
| *(v2.1)* **Render guard catches throws only** (`renderTab` try/catch) | Cheap, panel-scoped resilience: error paints in-panel, app survives; logged once per distinct message | Cannot catch non-terminating renders — the routeWire class of bug must be fixed at the source (and was) |
| *(v2.1)* **`postMessage` rejects when busy** (no queueing) | Prevents interleaving two prompts into one conversation; surfaces as a normal failed step with cascade-skip | A plan whose nodes share one bound session cannot run those steps concurrently |

---

## 2. Assumptions baked into the implementation

```
┌─ Environment assumptions (v2) ────────────────────────────────────────────┐
│ • Terminal ≥ the SELECTED size profile (compact 80×24 default); below it  │
│   a guard screen replaces rendering — input keeps working. (was: fixed %  │
│   splits with undefined behavior <80 cols — now resolved)                 │
│ • Terminal supports: alt-screen, SGR mouse (1000/1003/1006), 256-color,   │
│   truecolor, OSC 8 hyperlinks, OSC 52 clipboard, bracketed paste.         │
│   (still assumed, not probed — see §6 capability detection)               │
│ • Node ≥ 20 (only enforced by `doctor`, not package.json `engines`).      │
│ • A POSIX-ish shell ($SHELL or bash) exists for the Terminal panel.       │
│ • Single local user; one config file; no concurrency across processes.    │
│ • API keys available via env or ~/.config/agentfactory/config.json.       │
│ • Network reachable for LLM calls and registry/device login.              │
│ • One UTF-16 code unit per cell (no multi-codepoint glyphs in the grid).  │
├─ New implementation assumptions (v2) ─────────────────────────────────────┤
│ • package.json sits 1–2 levels above core/version.ts at runtime and is    │
│   named "agentfactory-harness" (getVersion guard).                        │
│ • settings values are strings; consumers parse ("true", "0.400").         │
│ • Feature `services` keys ('session', 'plan', 'plan-events') are unique   │
│   and consumers cast — no type registry.                                  │
│ • Studio node ids are the plan step ids (a-z0-9_-); renames remap edges.  │
│ • x-studio is ADDITIVE: executors/CLIs ignore it; absence = legacy file.  │
│ • The keymap suppresses single-printable bindings only when               │
│   textInputActive (Session tab; Config edit modal).                       │
├─ Session-binding assumptions (v2.1) ──────────────────────────────────────┤
│ • A session id IS the rollout file path — unique per create, stable while │
│   the file exists, gone when the file is deleted (ladder handles both).   │
│ • One writer per session at a time: postMessage rejects on streaming;     │
│   nothing else appends to a record's history mid-run.                     │
│ • Node ids make acceptable session names (they do: a-z0-9_- enforced).    │
│ • The 'session' service is registered before any canvas interaction that  │
│   needs it (lazy lookup per call tolerates registration order anyway).    │
│ • routeWire termination: every loop's step is Math.sign(end−start) of its │
│   OWN segment; a zero-delta segment never enters its loop (tested by an   │
│   exhaustive small-grid fuzz + the two former hang fixtures).             │
└───────────────────────────────────────────────────────────────────────────┘
```

When an assumption breaks, behavior is now mostly graceful: PTY spawn failure →
`[PTY unavailable]`; config write failure → `store.lastWriteError` banner; undersized
terminal → guard screen; invalid plan file → status-bar error + empty canvas; invalid
studio design → save/run blocked with the first fatal issue. Still **unverified**:
missing terminal capabilities (no probing — copy silently no-ops without OSC 52).

---

## 3. Identified gaps & risks (severity-ranked)

v1 risks R1–R9 were **resolved** by `feature/ui-consolidation` (see
`docs/changes/CHANGE-UI-CONSOLIDATION-STUDIO-2026-07-07.md` for the how):

| # | v1 gap / risk | Resolution |
|---|---|---|
| ~~R1~~ | app.ts god object | InputController/HitMap/Keymap extracted; feature registry; host ~490 lines |
| ~~R2~~ | Modal duplication | one `Overlay` widget (sm/md/lg); Esc + click-outside everywhere |
| ~~R3~~ | `DEFAULT_MAX_TOKENS = 2048` | model-aware `maxOutputTokens()` (8192/16384/4096) + override |
| ~~R4~~ | Version mismatch (was actually 4-way) | single `getVersion()` from package.json |
| ~~R5~~ | <80-col untested / no guard | size profiles + guard screen; verified live at 60×20 |
| ~~R6~~ | Color-only status | glyph+text everywhere (◎●✓✗⊘ + labels); inverse-bold focus titles; high-contrast theme; reduced motion |
| ~~R7~~ | Canvas superficial | StudioModel-backed studio: real data, typed wires, inspector, save/run, round-trip |
| ~~R8~~ | Split input pipeline | one TabEntry path (Terminal bypass intact); F6 bug found & fixed in the process |
| ~~R9~~ | Inconsistent interactions | wheel/wrap/Esc conventions applied; vim keys are keymap contributions listed in `?` |

**Current risks (v2, severity-ranked):**

| # | Risk | Impact | Sev |
|---|---|---|---|
| R10 | **Plaintext secrets in config.json** (unchanged) | Key exposure if file/host compromised | 🟡 |
| R11 | **Untyped `services` map** between features | A renamed key or shape drift fails at runtime, not compile time | 🟡 |
| R12 | **No terminal-capability probing** | OSC 52 copy / truecolor silently degrade with no notice | 🟡 |
| R13 | **Keymap remapping has no UI/validation** | `settings.keymap.*` structure exists but conflicts wouldn't be caught | 🟢 |
| R14 | **Studio host-side only tested via unit + smoke** | Divider drag and long mouse gestures have no automated coverage (manual-only) | 🟢 |
| R15 | **Handoff payload is cosmetic until the kernel** | `summary` vs `full` behave identically today; users may over-read the menu | 🟢 (documented) |

**Resolved in v2.1** (see `CHANGE-CANVAS-SESSION-BINDING-2026-07-09.md`):

| # | v2-era gap | Resolution |
|---|---|---|
| ~~R-wire~~ | `routeWire` infinite loop on vertical / col−1 wires — reachable EVERY frame via the wire-drag preview; froze the app and died as an OOM kill (no crash log, since a fatal V8 OOM never reaches `uncaughtException`) | Direction-safe per-segment loops (`Math.sign` of each segment's own delta); vertical arrows `▼`/`▲`; corner orientation fixed; exhaustive small-grid termination fuzz + both hang fixtures as regression tests |
| ~~R-render~~ | Any panel render throw → full TUI teardown | `App.renderTab` try/catch: in-panel `⚠ … failed to render` state, deduped log, app survives |
| ~~R-orphan-sessions~~ | Plan runs built per-step `Session` objects invisible to the UI (§4 v2 noted this) | Steps run in the node's bound session via `postMessage` — visible in Agents, transcript inspectable |

**New risks introduced or exposed by v2.1:**

| # | Risk | Impact | Sev |
|---|---|---|---|
| R16 | **Stale binding in saved plan files after a resume** — resume creates a NEW rollout id; the plan on disk still names the old one until the next `Ctrl+S` | Each open of a stale binding replays the OLD rollout again → duplicate `name*` sessions accumulate across restarts | 🟡 |
| R17 | **Session records are never garbage-collected** — canvas creates are cheap and deletes keep the session (by design), so long editing sessions accumulate Agents rows and rollout files | List noise + disk growth; no user-facing way to close/archive a session from the list | 🟡 |
| R18 | **Two nodes bound to one session break concurrent runs** — `postMessage` rejects on busy; nothing prevents or warns about duplicate bindings at design time | A valid-looking plan fails at run time with "Session … is busy" | 🟢 |
| R19 | **Smoke test inherits the real user config** — persisted `sizeProfile: wide` makes all 12 content checks fail on a 120×40 pane (observed 2026-07-08; environmental, not a regression) | False-negative gate; erodes trust in the smoke signal | 🟢 |

---

## 4. Missing scenarios (not handled or unverified)

```
┌─ Failure / edge cases the current code does NOT clearly handle (v2) ─────┐
│ NETWORK (unchanged from v1)                                               │
│  • LLM stream drops mid-response → partial line; no retry/backoff.        │
│  • Rate-limit / 429 from provider → surfaced as a raw error line only.    │
│  • Device-login poll timeout / network loss → overlay may stall.          │
│ INPUT / DATA                                                               │
│  • Malformed tool-call JSON from the model → JSON.parse may throw         │
│    inside the loop (dispatch is guarded, accumulation is not).            │
│  • Invalid/expired API key → fails at send; no proactive validation.      │
│ TERMINAL                                                                   │
│  • Terminal without OSC 52 → copy silently no-ops (no fallback notice).   │
│  • Width < profile minimum → RESOLVED (guard screen).                     │
│ ORCHESTRATION / STUDIO                                                     │
│  • Step timeout field round-trips through the studio but the executor     │
│    still does not ENFORCE it (inspector edits a no-op field today).       │
│  • Long-running step with no output → dashboard shows ● running only.     │
│  • Concurrent edit while a run streams statuses: statuses key off node    │
│    ids — deleting/renaming a mid-run node orphans its status (cosmetic).  │
│  • af-plan.json edited externally while the TUI is open → no file watch;  │
│    last Ctrl+S wins.                                                       │
│ CONCURRENCY                                                                │
│  • Two `factory` processes writing config.json → last-write-wins, no lock │
│    (now also covers settings, so divider/theme changes can race).         │
│ SESSION BINDING (v2.1)                                                     │
│  • Node rename does not rename the bound session — Agents shows the OLD   │
│    node id as the session name (binding itself survives, by test).        │
│  • Rollout file deleted while its session is LOADED → record keeps        │
│    working in memory; only persistence is silently gone.                  │
│  • x-studio.sessions hand-edited to a bogus path → handled (ladder falls  │
│    through to create), but no warning that the binding was replaced.      │
│  • Plan run against a session that is streaming an INTERACTIVE chat →     │
│    step errors "busy" (correct but surprising mid-conversation).          │
│  • renderTab error state is not exercised by any automated test (needs    │
│    an app-level harness — noted in the feature doc).                      │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Potential enhancements

*(v1's entire short-term list and most of the long-term list shipped in
`feature/ui-consolidation` — including the canvas/dashboard standalone forms and
`run --json`.)*

**Short-term (v2):**
- Enforce `StepSchema.timeout` in the executor (the studio already edits it — R-timeout).
- Typed service registry (generic `services.get<'session'>()` map) to close R11.
- Capability probing (OSC 52 / truecolor) with a one-time notice + fallback (R12).
- Success feedback channel in the status bar (Ctrl+S currently confirms only via log).
- `factory plan validate --strict` flag that also runs `validateStudio` design checks.

**Short-term (v2.1):**
- Auto re-save (or prompt) after a resume rebinds a node, closing the stale-binding
  window (R16).
- Close/archive action on Agents rows (R17) — the list is append-only today.
- `validateStudio` non-fatal WARNING when two nodes bind the same session (R18).
- Run `smoke-tui.sh` under an isolated `HOME` so persisted user settings cannot fail
  the gate (R19) — one-line fix in the script.
- Rename the bound session when its node is renamed in the inspector (cosmetic drift).

**Long-term (v2.1):**
- Queue (instead of reject) `postMessage` on a busy session — turns the shared-binding
  case from an error into serialization.
- Session lifecycle events on the services map so Agents can show created/resumed/
  closed transitions rather than re-projecting every frame.
- Bind-time model/provider override per node (today a bound session keeps whatever
  model it was created with; only UNBOUND step runs honor `step.model`).

**Long-term (v2):**
- The multi-agent kernel (PLAN-00–08): TeamSchema/TeamExecutor/MessageBus/SharedMemory/
  AskBroker — at which point the studio's handoff payloads become real (R15), logic-port
  nodes land in the toolbox, and the dashboard gains feeds/memory/asks.
- In-process hooks with a return channel (unblocks multi-agent context injection, PR #23).
- Keymap remapping UI over the existing `settings.keymap.*` structure (R13).
- Key encryption at rest / OS keychain integration (R10).
- Web renderer over the pure `StudioModel` (the core is already TUI-free by test).

---

## 6. Additional checks & safeguards to add

| Safeguard | Status / why |
|---|---|
| ~~Min-size guard~~ | **Shipped** (size profiles + guard screen) |
| **Redact API keys in logs** | Logger writes structured meta; ensure no key/token leaks into `factory-*.log` |
| **Retry/backoff on transient LLM errors (429/5xx)** | Today a transient error ends the turn |
| **Guard tool-input `JSON.parse`** | Wrap accumulation parse; emit a tool error instead of throwing the loop |
| **Proactive key validation** | A "test key" action in Config (cheap models.list call) before first use |
| **Config file lock or atomic write** | Prevent corruption under concurrent processes — now also protects settings |
| **Capability detection** | Probe OSC 52 / truecolor; fall back + notify when absent (R12) |
| **Step timeout enforcement** | Honor `StepSchema.timeout` in the executor — the studio now edits this field, so its no-op status is more visible (abort + cascade-skip on expiry) |
| **AbortSignal on quit** | Ensure an in-flight stream/run is aborted on `Ctrl+Q` (avoid orphaned requests) |
| *(v2)* **Backup before `Ctrl+S` overwrite** | First save over a hand-written af-plan.json replaces it; write `af-plan.json.bak` once per session |
| *(v2)* **Typed services registry** | Compile-time safety for the cross-feature seams (R11) |
| *(v2)* **NDJSON schema version field** | `run --json` consumers get a `v` field before the event shape ever changes |
| *(v2.1)* **Ban `c !== end` loop guards in render paths** | The routeWire hang pattern (`for (c = s; c !== e; c += dir)` with a dir not derived from `sign(e−s)`) is one grep away from recurring; add an ESLint rule or a review-checklist item for `!==` loop conditions with computed steps |
| *(v2.1)* **Render-time watchdog** | try/catch (shipped) cannot catch hangs; a per-frame duration log line above a threshold would have located routeWire in minutes instead of a live repro session |
| *(v2.1)* **Isolated-HOME smoke gate** | `smoke-tui.sh` must not inherit `~/.config/agentfactory` (R19); tmux SGR mouse injection (`send-keys -l $'\x1b[<0;C;RM'`) is proven viable for scripted e2e of the binding flows — automate §§3–5 of the new TESTING doc |
| *(v2.1)* **Duplicate-binding lint in validateStudio** | Non-fatal warning when `x-studio.sessions` maps two nodes to one id (R18) |
| *(v2.1)* **Rollout GC / archive policy** | Session records and `.jsonl` files only accumulate (R17); add an age/count cap or an explicit archive action |

**Process note (docs/PR):** every doc carries the four header markers; new/renamed files
update `.ai/project-index.yml` in the same commit; feature docs register in
`DOCUMENTATION-REGISTRY.md` and their folder README (via `scripts/docs-append.sh`);
gates per commit = `tsc --noEmit` + `npm test` + `scripts/smoke-tui.sh`. There is no
CI config in this repo — these gates are enforced by convention (Rule 3), so adding a
minimal CI workflow that runs the three gates is the highest-leverage process safeguard.

---

## 7. Verdict

**v2 (2026-07-07).** The structural debt that dominated v1 is paid: the god object is a
~490-line host over a feature registry, input flows through one declarative path, the five
modals share one frame, theming is token-based with an accessibility pass, small terminals
degrade deliberately, and the canvas went from a dead-end visualizer to a working studio
whose files the untouched executor runs (413 tests, 13-check tmux smoke, byte-level input
regression net). The remaining risks are **robustness and hardening** (network retries,
capability probing, timeout enforcement, secret storage, config locking) plus the typed-
services seam — none structural. The highest-leverage next investments are the multi-agent
kernel (PLAN-00–08), which turns the studio's recorded handoff semantics real, and a minimal
CI workflow to enforce the existing gates.

**v2.1 (2026-07-09).** The binding work closes the biggest conceptual seam left after
consolidation: the canvas, the Agents list, and sessions now share one identity (the
rollout id) across one boundary (the services map), and the studio's design-time
artifacts finally connect to run-time conversations. The crash fixed along the way is
the more instructive lesson: a per-frame code path with a `!==` loop guard hung the app
in a way NO error handler could see (OOM kill, empty crash log) — hence the new v2.1
safeguards (loop-guard lint, render watchdog). Test count 442 (20 added). Remaining
v2.1 debt is lifecycle, not structure: stale bindings after resume (R16), session
accumulation (R17), and the environment-sensitive smoke gate (R19).

*See `docs/testing/TESTING-UI-CONSOLIDATION-STUDIO-2026-07-07.md` (new surfaces),
`docs/testing/TESTING-CANVAS-SESSION-BINDING-2026-07-09.md` (binding + wire fix), and
`docs/testing/TESTING-FACTORY-E2E-2026-06-18.md` (Waves 0–5) for the end-to-end procedures.*
