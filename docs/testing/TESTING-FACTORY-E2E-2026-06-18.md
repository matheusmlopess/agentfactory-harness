# End-to-End Test Guide — `factory` (Waves 0–5)

<!-- version: 1.0.0 -->
<!-- classification: TESTING -->
<!-- date: 2026-06-18 -->
<!-- last-updated: 2026-06-22 -->
<!-- Manual E2E procedures for the implemented surfaces. Pair with docs/ddd/07-user-journeys.md. -->

How to validate the implemented system end-to-end: preconditions, manual steps, expected
results, validation checks, and failure indicators per surface.

## Global preconditions

```
┌─ Before any test ────────────────────────────────────────────────────────┐
│ 1. Node ≥ 20:               node --version                                │
│ 2. Install + build:         npm install && npm run build                  │
│ 3. Unit tests green:        npm test                                      │
│ 4. A key configured:        export ANTHROPIC_API_KEY=...   (or OPENAI_…)   │
│                             or set it in the Config tab (F5)              │
│ 5. Terminal: ≥ 80 cols, 256-color, mouse-capable (most modern emulators). │
│ 6. Run the TUI:             node dist/index.js     (or: npm run dev)      │
└───────────────────────────────────────────────────────────────────────────┘
```

Confirm correctness baseline: `npm test` passes and `factory doctor` shows the expected ✓/✗.

---

## T1 — Doctor (CLI)

| | |
|---|---|
| **Pre** | Built binary; optionally unset all keys to see ✗ rows. |
| **Steps** | `node dist/index.js doctor` |
| **Expected** | A colored table: Node ≥20, LLM_PROVIDER, ANTHROPIC_API_KEY, OPENAI_API_KEY, registry token, `.ai/`, `CLAUDE.md`; then `N/total checks passed`. |
| **Validate** | Set a key → re-run → that row flips ✓. Exit code non-zero only on hard failures. |
| **Failure signs** | Crash/stack trace; wrong Node verdict; mutating state (it must be read-only). |

---

## T2 — Session chat (the core loop) — HAPPY PATH

| | |
|---|---|
| **Pre** | TUI open on Session tab; a valid key set. |
| **Steps** | Type `hello, summarize what you can do` → Enter. |
| **Expected** | Input echoes; prompt switches to `… ` while streaming; assistant text streams in live; StatusBar/Agents show token + turn counts; a rollout file appears under `~/.config/agentfactory/sessions/<date>/`. |
| **Validate** | `ls ~/.config/agentfactory/sessions/<today>/` shows a `rollout-*.jsonl`; `tail` it → `meta`, `user`, `assistant`, `stats` lines. |
| **Failure signs** | No streaming; UI freeze during stream; tokens never update; empty/absent rollout file. |

### T2b — Tool use
- **Steps:** Ask `list the files in the current directory` (triggers Bash/Read).
- **Expected:** system lines `  tool: bash` then `  → <preview>`; the model continues with results.
- **Validate:** rollout has a `tool` event; the answer reflects real output.
- **Failure signs:** tool line with no result; loop hangs; `Error:` surfaced without recovery.

### T2c — EDGE: no/invalid key
- **Pre:** unset all keys (or set a bogus one).
- **Steps:** send a prompt.
- **Expected:** a **system error line** in the chat (graceful), UI stays responsive.
- **Failure signs:** uncaught crash; app exits; frozen input.

### T2d — EDGE: interrupt / quit mid-stream
- **Steps:** start a long reply, press `Ctrl+Q`.
- **Expected:** app exits cleanly, terminal restored (cursor shown, alt-screen exited, mouse off).
- **Failure signs:** garbled terminal after exit; orphaned cursor; mouse codes leaking to shell.

---

## T3 — Model picker

| | |
|---|---|
| **Steps** | `/model` (or click `[model]` in the status bar) → choose a provider → choose a model. |
| **Expected** | Centered picker; provider step first; model step shows a loading state then a live list (newest first); arrows navigate, Enter selects, Esc backs out/closes. |
| **Validate** | Status bar shows the chosen `[model]`; next message uses it. |
| **Failure signs** | Empty model list with a configured key; picker won't close on Esc; selection not applied. |

---

## T4 — Orchestration run

### T4a — HAPPY: valid plan
- **Pre:** a valid `af-plan.json` in cwd (or `factory plan new`).
- **Steps (CLI):** `node dist/index.js run af-plan.json` — or in TUI press `Ctrl+R`.
- **Expected:** `step:start`/`step:done` events stream (stderr in CLI; block colors on the canvas in TUI); final `plan:done`. Dependencies run in order; independent steps run concurrently (≤3).
- **Validate:** `factory plan validate af-plan.json` → `Plan "<name>" is valid (<n> steps)`.
- **Failure signs:** steps run out of dependency order; concurrency > 3; no `plan:done`.

### T4b — EDGE: cycle
- **Steps:** craft a plan where A dependsOn B and B dependsOn A → `run` (or `validate`).
- **Expected:** fails fast with `Plan contains cycles: …`; no steps execute.
- **Failure signs:** hang; partial execution; silent success.

### T4c — FAILURE: cascade skip
- **Steps:** a plan where step 2 fails and step 3 dependsOn step 2.
- **Expected:** `step:error` for 2, then `step:skipped` for 3 (and all downstream); `plan:done`.
- **Failure signs:** downstream runs anyway; executor throws instead of skipping.

---

## T5 — Embedded terminal

| | |
|---|---|
| **Steps** | F4 → run `ls`, `echo hi`, a colored command (e.g. `ls --color`) → `Shift+PgUp` to scroll back → `F1` to leave. |
| **Expected** | Keystrokes reach the real shell; output renders with colors/wide chars; scrollback works; Ctrl+Q quits app, Ctrl+P opens palette, F-keys switch tabs; **everything else** reaches the shell. |
| **Validate** | `vim`/`htop`-style full-screen apps render (alt-screen handled by VTScreen). |
| **Failure signs** | Keys captured by the app instead of the shell; broken colors; `[PTY unavailable]` on a normal system. |

---

## T6 — Config (keys / login / import)

### T6a — Edit a key
- **Steps:** F5 → navigate to a provider → Enter or double-click → type a value → Enter.
- **Expected:** masked input modal with env-var label + format hint + clickable token URL; on save the row shows `[set]` (masked).
- **Validate:** `cat ~/.config/agentfactory/config.json` → the key is present in `keys` (or `urls` for url-type).
- **Failure signs:** value stored unmasked in the list; save no-ops; `store.lastWriteError` banner (disk/permission).

### T6b — Delete a key
- **Steps:** select a set key → `Ctrl+R` (or click `[✕]`).
- **Expected:** row reverts to `(not set)`; removed from config.json.

### T6c — Device login
- **Steps:** click `[Login]`.
- **Expected:** overlay with a user code + verify URL + countdown spinner; completing in the browser flips the header to `● @handle (plan)`; `~/.agentfactory/token` is written.
- **Failure signs:** spinner never resolves on success; no token file; header doesn't update.

---

## T7 — Logs & insights

| | |
|---|---|
| **Steps** | F6 → watch live logs → click a source chip to filter → select an entry → click `[⚡ Analyze]`. |
| **Expected** | Auto-scrolling list (time·level·message, level-colored); filter narrows by source; entry detail shows meta; metrics view shows rate + by-level/by-source bars; Analyze streams an AI summary; a 2-min heartbeat countdown auto-analyzes. |
| **Validate** | Filter to one source → only those rows show; `c` clears; vim keys (`j/k/h/l`) navigate. |
| **Failure signs** | List doesn't auto-scroll on new logs; Analyze button unresponsive; countdown stuck. |

---

## T8 — Resume a session

| | |
|---|---|
| **Pre** | At least one prior session exists (run T2 once). |
| **Steps** | `/resume` → pick a prior session. |
| **Expected** | List newest-first; selecting replays recorded events into a new `*`-suffixed session; history + stats reconstructed. |
| **Validate** | The replayed transcript matches the source `rollout-*.jsonl`. |
| **Failure signs** | Empty resume list despite saved files; replay drops events; crash on malformed rollout. |

---

## T9 — Copy (selection + clipboard)

| | |
|---|---|
| **Steps** | Click-drag over chat text → release. (Also try `Ctrl+E` for native selection.) |
| **Expected** | Drag highlights (reverse video); release copies via OSC 52; paste elsewhere yields the text. `Ctrl+E` toggles NORMAL↔SELECT (status bar). |
| **Failure signs** | No highlight; nothing on clipboard (note: terminals without OSC 52 silently fail — known gap). |

---

## Correctness confirmation checklist

```
┌─ The implementation is behaving correctly when ALL hold ─────────────────┐
│ [ ] npm test passes; factory doctor matches the environment.             │
│ [ ] A prompt streams a reply and writes a rollout file (T2).             │
│ [ ] A tool call executes and its result feeds back into the reply (T2b). │
│ [ ] No-key / interrupt paths degrade gracefully, terminal restores (T2c/d).│
│ [ ] Model picker lists live models and applies the selection (T3).       │
│ [ ] A valid plan runs in dependency order ≤3 concurrent; cycle rejected; │
│     failure cascades to skip (T4a/b/c).                                   │
│ [ ] Terminal forwards keys to the shell; F-keys/Ctrl-Q/P intercepted (T5).│
│ [ ] Config edit/delete persists to config.json; login writes token (T6). │
│ [ ] Logs filter/detail/analyze work; heartbeat counts down (T7).         │
│ [ ] Resume replays a saved session faithfully (T8).                      │
│ [ ] Selection copies via OSC 52 (T9).                                    │
└───────────────────────────────────────────────────────────────────────────┘
```

## Common failure indicators (quick reference)

| Symptom | Likely cause |
|---|---|
| Garbled terminal after exit | cleanup sequence not flushed (alt-screen/mouse/cursor) |
| UI frozen during a reply | a synchronous block in the render/stream path |
| Tokens never update | `usage`/`stats` events not consumed or estimate path broken |
| Empty model list (key set) | provider `listModels` failure / wrong key bucket |
| Truncated replies | `DEFAULT_MAX_TOKENS = 2048` (known gap) |
| Copy does nothing | terminal lacks OSC 52 (known gap) |
| Layout overflow | terminal < 80 cols (known gap — no min-size guard) |
| `[PTY unavailable]` | node-pty spawn failed (shell/permissions) |

---

# Appendix — docs-system agent reproduction (E2E)

Validates that the **`docs-system`** AgentFactory agent (https://github.com/matheusmlopess/docs-system),
when applied to a clean `main`, reproduces the documentation reorganization established on the
benchmark branch `feature/ui-fixes`.

## A1 — Structure comparison: `main` → benchmark (`feature/ui-fixes`)

```
BEFORE  (origin/main, 27 loose docs)            AFTER / BENCHMARK  (feature/ui-fixes)
─────────────────────────────────────           ──────────────────────────────────────────
docs/                                           docs/
├── DOCUMENTATION-{TAXONOMY,TEMPLATES,           ├── documentation/   <- governance moved here
│   QUICK-START,REGISTRY}.md   (root)            │     DOCUMENTATION-* GLOSSARY README MEMORIAL
├── FEATURE-*.md            (7 loose, undated)   ├── features/   FEATURE-<NAME>-<DATE>.md x12
├── FEATURE-WAVE-0/1/2 ...                       │               + README + MEMORIAL
├── CHANGE-SUMMARY-LOGS-PANEL.md                 ├── changes/    CHANGE-<NAME>-<DATE>.md + MEMORIAL
├── GAP-ISSUE-MATRIX.md                          ├── reviews/    DESIGN/GAPS/REVIEW/INDEX-*-<DATE> x9
├── LOGGER.md                                    │               + README + MEMORIAL
├── TESTING-LOGS-PANEL.md                        ├── testing/    TESTING-*-<DATE> + README + MEMORIAL
├── REVIEW-SECURITY-*.md (2)                     ├── PLANS/      PLAN-* x16 + README + MEMORIAL
├── FUTURE-WORK.md  WAVE-PLAN.md                 ├── ddd/        14-file design set + INDEX + MEMORIAL
├── features/  (5 undated FEATURE-*)             ├── WAVE-PLAN.md  FUTURE-WORK.md  (roadmap, root)
└── reviews/   (4 undated)                       └── assets/
                                                 (+ markers on every doc, reference sweep, registry)
```

## A2 — Test output: applying the agent to a fresh `main`

Imported via `agentfactory-gen import --from-git ...` -> ran the imported `docs-migrate.sh --apply`
+ `docs-compile.sh`. Migrate plan (excerpt) vs benchmark:

```
docs/FEATURE-LOGS-PANEL.md     -> docs/features/FEATURE-LOGS-PANEL-2026-06-09.md     FEATURE  ok
docs/GAP-ISSUE-MATRIX.md       -> docs/reviews/GAPS-ISSUE-MATRIX-2026-05-01.md       GAPS     ok (GAP->GAPS auto)
docs/TESTING-LOGS-PANEL.md     -> docs/testing/TESTING-LOGS-PANEL-2026-06-09.md      TESTING  ok
docs/DOCUMENTATION-TAXONOMY.md -> docs/documentation/DOCUMENTATION-TAXONOMY.md       REVIEW   ok (v1.0.1 fix)
... 24 moves total ...
NEEDS-REVIEW (not auto-moved):  docs/LOGGER.md   <- no TYPE prefix (human decision)
```

Resulting folder counts (agent output vs benchmark):

| Folder | agent output | benchmark | delta = |
|---|---|---|---|
| features/ | 11 + MEMORIAL | 12 | `FEATURE-LOGGER` (human reclassified `LOGGER.md`) |
| testing/ | 1 + MEMORIAL | 2 | `TESTING-FACTORY-E2E` (**net-new authored**) |
| reviews/ | 7 + MEMORIAL | 9 | 2 **net-new authored** reviews |
| changes/ | 1 + MEMORIAL | 1 | identical |

**Conclusion:** the agent reproduces the documentation **system + deterministic reorg** (folders,
dated names, `GAP->GAPS`, governance -> `documentation/`, MEMORIAL compendiums). The only deltas are
(1) one **human-judgment** item correctly flagged `NEEDS-REVIEW` (`LOGGER.md`), and (2) **net-new
hand-authored** docs (ddd/, specs, new reviews) that no reorganizer can invent.

## A3 — Import methods tested (agentfactory-gen 0.3.2)

| Method | Local? | Imported | Notes |
|---|---|---|---|
| `import --from-git <https-url>` | no (URL only) | **scripts only** (4) | auto-retrofit regenerates its own manifest |
| `import --from-git <local-path>` | — | **rejected** | requires `https://` / `git@` / `ssh://` |
| `import <bundle.zip>` (pre-built) | **yes** | **full agent** — 4 skills, 4 commands, 1 doc, 4 scripts | recommended; bundle attached to each release |

For a **local** import, or to get the **skill + commands** (not just scripts), use the bundle ZIP
(`scripts/make-bundle.sh` / release asset): `agentfactory-gen import docs-system-agent.zip --allow-scripts`.
