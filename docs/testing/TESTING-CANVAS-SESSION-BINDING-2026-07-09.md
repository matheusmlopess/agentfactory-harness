# TESTING — Canvas Session Binding + Wire Fix: End-to-End Guide
<!-- version: 1.0.0 -->
<!-- classification: TESTING -->
<!-- date: 2026-07-09 -->
<!-- last-updated: 2026-07-09 -->

End-to-end test procedure for the 2026-07-08 canvas work: the `routeWire`
infinite-loop fix, the per-panel render guard, and the canvas ↔ Agents ↔
sessions binding (auto-bind on create, Open/Bind session, click-to-open,
bound plan runs). Companion docs:
`docs/features/FEATURE-CANVAS-SESSION-BINDING-2026-07-08.md` (behavior),
`docs/changes/CHANGE-CANVAS-SESSION-BINDING-2026-07-09.md` (delta).

## 0. Preconditions

- Node ≥ 20, deps installed (`npm install` done), `tmux` available for the
  scripted variant.
- A terminal at least as large as the **selected size profile**. ⚠ The
  profile persists in `~/.config/agentfactory/config.json`
  (`"sizeProfile": "wide"` needs 140×40 — below it you get the guard screen,
  NOT a bug). To test hermetically, run with an isolated HOME:

```bash
$ export TESTHOME=$(mktemp -d)
$ tmux new-session -d -s bind-test -x 120 -y 40 "HOME=$TESTHOME npx tsx src/index.ts"
```

- No API key is required for any step below except 6 (bound plan run).
- Nothing else writing `./af-plan.json` in the working directory.

## 1. Automated gates (run first — ~1 min)

```bash
$ npx tsc --noEmit          # expect: silence (strict mode clean)
$ npx vitest run            # expect: 47 files / 442 tests passed
$ npx vitest run src/features/canvas/wire.test.ts        # 15 tests
$ npx vitest run src/features/session/panel.test.ts      #  7 tests
```

**Validation check:** the wire suite finishing AT ALL is itself the crash
regression test — before the fix, two of its fixtures never returned. A
hang here (vitest stuck on `RUN`) means the routing loop regressed.

## 2. Wire-routing crash regression (the former freeze)

Manual, in the running TUI (F2 = Orchestration tab):

1. Press `t`, click `worker`, click an empty cell → box `agent-1` appears
   (Esc closes the inspector).
2. Repeat and place `agent-2` DIRECTLY BELOW `agent-1` (same column).
3. Click `agent-1`'s output port `○` (right edge), then move the mouse
   straight down toward `agent-2`.

**Expected:** a live preview wire renders with `│` segments and a `▼` head;
the app stays responsive throughout the drag.
**Failure indicator (old bug):** the UI freezes the instant the cursor
enters the port's column; CPU pins at 100%; the process eventually dies
with no entry in `/tmp/factory-err.log` (OOM kill, not a throw).

Headless equivalent (safe — times out instead of hanging your shell):

```bash
$ timeout 5 npx tsx -e "
import { routeWire } from './src/features/canvas/Wire.ts';
console.log(routeWire({row:0,col:10},{row:4,col:10}).length);   // 5
console.log(routeWire({row:1,col:5},{row:6,col:4}).length);     // 6
"; echo "exit: $?"     # exit: 0 = fixed; exit: 124 = hang regression
```

## 3. Create an agent box → appears in Agents list

1. F2 → right-click empty canvas → `Add agent block` → Esc (close inspector).
2. Look at the Agents panel (bottom-right).

**Expected:** a new row `○ agent-1` appears immediately, alongside the
default laureate session (e.g. `★ ○ Curie`). The star marks the ACTIVE
session — creating a canvas agent must NOT steal it.
**Validation check:** type into the Session panel — input still goes to the
original session, proving focus was not moved by the background create.

## 4. Open session from a block (all three binding states)

**Bound + live (happy path):**
1. Right-click the `agent-1` box → menu shows
   `Configure… / Open session / Bind session… / Delete block`.
2. Click `Open session`.

**Expected:** Session panel header becomes `session "agent-1"`; the Session
tab gains focus (typing goes to agent-1's input); in the Agents list the `★`
moves to `agent-1`. The `o` key on a selected block does the same.

**Bound + on disk only (resume):**
3. `Ctrl+S`, quit (`Ctrl+Q`), relaunch, wait for `af-plan.json` to load.
4. Right-click the box → `Open session`.

**Expected:** a session named `agent-1*` (resumed marker) opens with the
prior transcript replayed. Re-save: the plan's binding now points at the
NEW rollout id (self-heal — see decision table in the feature doc).

**Dangling (rollout deleted):**
5. Quit, delete the bound `.jsonl` under
   `~/.config/agentfactory/sessions/…`, relaunch, `Open session`.

**Expected:** a FRESH `agent-1` session is created, bound, and opened — the
action never dead-ends or errors at the user.

## 5. Bind an existing session + Agents click-through

1. Right-click the box → `Bind session…`.

**Expected:** a chained menu lists every session — `★ Curie`, `· agent-1
(bound)` — plus `Unbind` when bound. Picking one rebinds; `Ctrl+S` then
persists it under `x-studio.sessions` in `af-plan.json` (inspect the file).

2. Click any row in the Agents list.

**Expected:** the active session switches AND the Session tab takes focus
(before this change it only switched, without navigating).

## 6. Bound plan run (needs an API key)

1. Wire `agent-1 → agent-2` (dependency), give both prompts, `Ctrl+R`.

**Expected:** each step streams into ITS OWN session — watch the Agents
list statuses (◎ running → ✓/✗) and open either session afterwards to read
the full transcript. Step 2's prompt interpolates `{{agent-1}}` output.
**Failure indicator:** a step erroring instantly with `Session … is busy`
means two steps share one bound session — rebind one of them.

## 7. Render guard (defense-in-depth)

No user-visible path throws today, so this is covered by reading
`src/app.ts` `renderTab()` + the unit suites. If any panel ever throws
mid-render you should see `⚠ <title> failed to render — see Logs` inside
that panel's frame — the app itself must keep running. NOT currently
automated (needs an app-level harness).

## 8. Correctness confirmation checklist

```
[ ] tsc --noEmit silent; vitest 442/442 green
[ ] wire.test.ts completes (no hang) — 15 tests
[ ] vertical + col−1 wire drags render │/▼ live, app responsive
[ ] new canvas box → Agents row appears, ★ does not move
[ ] Open session (menu + o key) focuses the right conversation
[ ] resume path renames to "name*" and rebinds to the fresh id
[ ] deleted rollout → fresh session, no error surfaced
[ ] Bind session… lists all sessions, Unbind appears only when bound
[ ] af-plan.json contains x-studio.sessions after Ctrl+S
[ ] Agents list click switches session AND navigates to Session tab
[ ] Ctrl+R streams each step into a visible, inspectable session
```

## 9. Common failure indicators & first moves

| Symptom | Likely cause | First move |
|---|---|---|
| App freezes during wire drag | routing loop regression | `timeout 5 npx tsx -e …routeWire…` (see §2); check the loop steps use `Math.sign` per segment |
| "Terminal too small" at launch | persisted `sizeProfile` vs actual terminal | isolated `HOME` or resize — NOT a regression |
| Canvas box missing from Agents | session bridge not registered before use | check `services.set('session', …)` ran; Agents list is a projection of `metas()` |
| Open session lands on wrong conversation | stale binding after manual af-plan.json edits | re-save from the TUI; bindings self-heal on next open |
| Step fails with "busy" | two nodes bound to one session ran concurrently | rebind one node (`Bind session…`) |
| Crash with EMPTY /tmp/factory-err.log | hang/OOM (not a throw) | look for non-terminating loops, not exception handlers |
| `x-studio.sessions` missing after save | node was never bound (headless create path) | bind via menu, save again; legacy files default to `{}` |
