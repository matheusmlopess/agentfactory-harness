<!-- version: 1.0.0 -->
<!-- classification: SUMMARY -->
<!-- date: 2026-06-19 -->
<!-- last-updated: 2026-06-18 -->
<!-- status: ACTIVE -->
<!-- generated-by: scripts/docs-compile.sh -->

# TESTING — Memorial (Descriptive Compendium)

> **Auto-generated** by `scripts/docs-compile.sh` — **do not edit by hand**.
> Edit the source docs in `testing/` and re-run the script.
> Documents: **2** · ordered by creation date · each section links its source.

<a id="index"></a>
## Index

1. [Testing Guide: Logs Panel with Metrics Dashboard and Auto-Analysis](#d1) — `2026-06-09` — Complete end-to-end testing procedures for the Logs panel feature. · [[TESTING-LOGS-PANEL-2026-06-09]]
2. [End-to-End Test Guide — `factory` (Waves 0–5)](#d2) — `2026-06-18` — How to validate the implemented system end-to-end: preconditions, manual steps, expected · [[TESTING-FACTORY-E2E-2026-06-18]]

## Glossary

Term & acronym definitions: [GLOSSARY](../documentation/GLOSSARY.md) · [[GLOSSARY]]

---

<a id="d1"></a>

## 1 · 2026-06-09 · Testing Guide: Logs Panel with Metrics Dashboard and Auto-Analysis

Source: [TESTING-LOGS-PANEL-2026-06-09.md](TESTING-LOGS-PANEL-2026-06-09.md) · [[TESTING-LOGS-PANEL-2026-06-09]]  ·  [↑ Index](#index)


Complete end-to-end testing procedures for the Logs panel feature.

---

## Test Environment Setup

### Preconditions

```bash
# 1. Clone and enter worktree
cd /home/magooo/repo/worktrees/registry-auth-login

# 2. Build project
npm run build
# Expected: ESM ⚡️ Build success, DTS Build success

# 3. Verify tests pass
npm test
# Expected: 278 passed (all existing tests)

# 4. Start dev server
npm run dev
# Expected: TUI appears, ready for manual testing
```

### System Requirements

- **Terminal**: 256 color support, SGR mouse mode (1003)
- **Width**: ≥ 80 columns (recommended 120+)
- **Height**: ≥ 24 rows (recommended 40+)
- **OS**: Linux, macOS, or WSL2 (no Windows CMD, use Git Bash)

---

## Test Categories

### Category A: UI Rendering & Mouse Interaction

#### A1: Logs Tab Accessible and Renders

**Steps**:
1. Start app: `npm run dev`
2. App displays Session tab by default
3. Press `F6` key
4. Verify Logs tab appears

**Expected Result**:
```
╔══════════════════════════════════════╦═══════════════════════════════════╗
║ [All]                                ║ ─ Metrics ─────────── [⚡ Analyze] ║
╠════════════════════════════════════╬═══════════════════════════════════╣
║ LOGS (left column, 40%)             ║ METRICS / DETAILS (right, 60%)    ║
║                                      ║                                   ║
║ 14:32:05 INFO Session ...           ║ Total: N entries  Rate: X/min      ║
║ 14:32:04 INFO Session ...           ║ By Level:                          ║
║ ...                                  ║   INFO  ████████ N                 ║
║                                      ║   WARN  ██ N                       ║
╚════════════════════════════════════╩═══════════════════════════════════╝
```

**Validation**:
- ✓ Tab is visible and full-screen
- ✓ Left column shows log entries with timestamps
- ✓ Right column shows metrics dashboard
- ✓ No rendering artifacts or corruption
- ✓ Border characters are correct (═, ║, ╔, ╦, ╣, ╩)

---

#### A2: Filter Chips Clickable

**Steps**:
1. Logs tab is open
2. Left-click on `[All]` chip
3. Verify it highlights
4. Left-click on `[Session]` chip
5. Verify `[Session]` highlights, `[All]` unhighlights

**Expected Result**:
- Clicked chip has inverted colors (fg/bg swap)
- Unselected chips return to normal
- Log list updates immediately

**Common Failure Indicators**:
- ✗ Click has no effect (mouse rect bug)
- ✗ Wrong chip highlights (click detection off)
- ✗ Chip text is cut off (width calculation wrong)

---

#### A3: Log Entry Selection via Mouse Click

**Steps**:
1. Logs tab is open, left column has entries
2. Left-click on first entry
3. Verify entry is highlighted
4. Right column switches from metrics to entry detail

**Expected Result**:
```
LEFT COLUMN:              RIGHT COLUMN:
14:32:05 INFO Session   ─ Entry ─────────── [⚡ Analyze] ─
  ↑ highlighted         Time:    14:32:05
14:32:04 INFO Session   Level:   INFO
                        Source:  Session
                        Message: session created
                        Meta: { name: "Curie", total: 3 }
```

**Validation**:
- ✓ selectedIdx matches clicked entry
- ✓ Entry highlight color changes (bg color)
- ✓ Right column switches from metrics to detail
- ✓ All entry fields visible

**Common Failure Indicators**:
- ✗ Click on entry doesn't select it (mouse rect still wrong?)
- ✗ Right column doesn't update
- ✗ selectedIdx is off by one

---

#### A4: Scroll Wheel on Left Column

**Steps**:
1. Logs tab is open
2. 10+ entries in left column
3. Scroll wheel UP (away from you)
4. Verify older entries appear (scroll offset increases)
5. Scroll wheel DOWN
6. Verify newer entries appear (scroll offset decreases)

**Expected Result**:
- Visible entries change smoothly
- No flickering or jumps
- Scroll offset stays within bounds

**Common Failure Indicators**:
- ✗ Scroll has no effect
- ✗ Scroll goes too far (offset < 0 or > max)
- ✗ Visual glitch (entries appear twice, blank rows)

---

#### A5: Scroll Wheel on Right Column (Insights)

**Steps**:
1. Logs tab is open, insights section has text
2. Scroll wheel UP in right column
3. Verify older insights appear
4. Scroll wheel DOWN
5. Verify newer insights appear

**Expected Result**:
- Insights text scrolls independently from logs
- Multiple analyses visible (if available)

---

### Category B: Keyboard Navigation

#### B1: Arrow Key Navigation (Up/Down)

**Steps**:
1. Logs tab is open
2. Press `↑` key
3. Verify first entry becomes selected
4. Press `↑` again
5. Verify no selection (metrics view returns)
6. Press `↓` key
7. Verify last entry becomes selected

**Expected Result**:
- ↑ moves selection up; at top, deselects
- ↓ moves selection down
- selectedIdx updates correctly

---

#### B2: Arrow Key Navigation (Left/Right) — Filter Switching

**Steps**:
1. Logs tab, filter is `[All]`
2. Press `→` (right arrow)
3. Verify filter moves to `[Session]` (or next available)
4. Press `→` again
5. Verify filter continues to cycle
6. Press `←` (left arrow)
7. Verify filter moves backward

**Expected Result**:
- Each keypress cycles through sources: All → Session → Config → Agents → All
- Filter chip highlights update
- Log list updates for each source

---

#### B3: Keyboard Shortcuts (A, C, H, J, K, L)

**Setup**: Configure key repeats in terminal if needed.

| Key | Expected Action | Validation |
|-----|-----------------|-----------|
| `K` | Same as ↑ | Selection moves up or deselects |
| `J` | Same as ↓ | Selection moves down |
| `H` | Same as ← | Filter moves left |
| `L` | Same as → | Filter moves right |
| `A` | Analyze (if not streaming) | Analysis starts |
| `C` | Clear logs | Logs emptied, metrics reset to 0 |

**Expected Result**:
- All shortcuts work as documented
- No console errors

---

### Category C: Live Logging

#### C1: Session Panel Logs on Action

**Steps**:
1. Logs tab is open
2. Switch to Session tab
3. Type a message and press Enter
4. Switch back to Logs tab
5. Verify new entry appears: `message sent`

**Expected Result**:
```
14:32:05 INFO Session  message sent
Metadata: { length: 42, chatMode: false }
```

**Validation**:
- ✓ Timestamp is current (within 1 second)
- ✓ Level is INFO
- ✓ Source is Session
- ✓ Message text is "message sent"
- ✓ Metadata includes length and chatMode

---

#### C2: Multiple Panel Logging

**Steps**:
1. Logs tab is open
2. Session tab: send a message
3. Agents tab: click a different session
4. Config tab: if unlocked, trigger an action (e.g., save API key)
5. Switch to Logs tab
6. Verify 3+ new entries from different sources

**Expected Result**:
```
14:32:10 INFO Session   message sent
14:32:11 DEBUG Agents   session selected
14:32:12 INFO Config    api key saved
```

**Validation**:
- ✓ All panels log correctly
- ✓ Source labels match the panel
- ✓ Timestamps increment in order

---

#### C3: Auto-Scroll When Viewing Newest Entries

**Steps**:
1. Logs tab is open, scroll offset = 0 (viewing newest)
2. Generate new log entry (send message in Session)
3. Verify new entry appears at bottom without manual scroll
4. Scroll UP manually to view older entries
5. Generate another log entry
6. Verify list does NOT auto-scroll (user stays at their scroll position)
7. Scroll DOWN to bottom
8. Verify auto-scroll resumes for new entries

**Expected Result**:
- Auto-scroll only when viewing newest entries
- User can "freeze" view by scrolling up
- Resume auto-scroll by scrolling down

---

### Category D: Metrics Dashboard

#### D1: Total Count and Rate Calculation

**Setup**: Generate 10 messages over 1 minute.

**Steps**:
1. Note current time: 14:30:00
2. Send 10 messages (one every 6 seconds)
3. Open Logs tab at 14:31:00
4. Note displayed rate: should be ~10/min

**Expected Result**:
```
Total: 10 entries   Rate: 10.0/min
```

**Validation**:
- ✓ Total count is accurate
- ✓ Rate calculation is reasonable (10/min ≈ actual)

---

#### D2: By-Level Distribution

**Steps**:
1. Logs tab is open
2. Note displayed bar chart for INFO, WARN, ERROR
3. Count entries manually for each level
4. Compare counts to bar chart values

**Expected Result**:
```
By Level:
INFO  ██████████████ 38
WARN  ████            8
ERROR █               1
```

**Validation**:
- ✓ Counts match manual count
- ✓ Bar widths are proportional to counts
- ✓ Max bar width is ~12 characters (█ repeated)

---

#### D3: By-Source Breakdown (Top 4)

**Steps**:
1. Logs tab is open
2. Verify sources are sorted by count (descending)
3. Compare rendered counts to actual counts

**Expected Result**:
```
By Source:
Session     31  ██████████
Config       9  ███
Agents       7  ██
App          2  █
```

**Validation**:
- ✓ Sorted in descending order
- ✓ Only top 4 sources shown
- ✓ Counts match actual

---

#### D4: Metrics Update on Filter Change

**Steps**:
1. Logs tab, filter is `[All]`
2. Note total count: 47
3. Click `[Session]` filter
4. Note new total count: 31 (Session entries only)
5. By-level bar heights adjust (no more WARN/ERROR from other sources)

**Expected Result**:
- Total decreases
- Bar charts shrink appropriately
- Metrics recalculate in <100ms

---

### Category E: Analysis (Manual)

#### E1: Manual Analysis Button Click

**Steps**:
1. Logs tab is open, 3+ entries present
2. Right column shows metrics or entry detail
3. Click `[⚡ Analyze]` button
4. Verify button changes to `[⟳ Analyzing…]`
5. Wait for LLM response to stream (should start within 2 seconds)

**Expected Result**:
```
Before:                      After Click:
[⚡ Analyze]                 [⟳ Analyzing…]
                             (button disabled, text streaming below)
```

**Validation**:
- ✓ Button state changes immediately
- ✓ LLM response starts within 2 seconds
- ✓ No network errors or timeouts
- ✓ Button remains disabled during streaming

---

#### E2: Analysis Streaming

**Steps**:
1. Click `[⚡ Analyze]`
2. Watch insights section for text appearing line-by-line
3. Wait for analysis to complete

**Expected Result**:
```
[14:32:15] Manual analysis:
No errors detected in the past 30 seconds. The system is running
smoothly with steady log rates across all modules. Consider monitoring
the response latencies shown in the Session logs.
```

**Validation**:
- ✓ Text appears in real-time (not all at once)
- ✓ Timestamp header is accurate
- ✓ Analysis makes sense for the logs

---

#### E3: Button Re-enables After Analysis

**Steps**:
1. Click `[⚡ Analyze]`, wait for completion
2. Verify button returns to `[⚡ Analyze]`
3. Click again to trigger another analysis

**Expected Result**:
- Button re-enables within 1 second of stream end
- Can trigger multiple analyses in sequence

---

#### E4: Analysis Preserves Previous History

**Steps**:
1. Click `[⚡ Analyze]`, wait for completion (Analysis A)
2. Generate new logs (send message, etc)
3. Wait 30 seconds
4. Click `[⚡ Analyze]` again (Analysis B)
5. Verify insights section shows both analyses

**Expected Result**:
```
[14:30:15] Manual analysis:
...first analysis text...

[14:32:45] Manual analysis:
...second analysis text...
```

**Validation**:
- ✓ Both analyses visible in insights
- ✓ Timestamps show both
- ✓ Scrolling can access both analyses

---

### Category F: Auto-Analysis Heartbeat

#### F1: Heartbeat Triggers Every 120 Seconds

**Setup**: Use `watch -n 1 'date +%H:%M:%S'` in another terminal to track time.

**Steps**:
1. Start app at T=0
2. Open Logs tab, note metrics dashboard shows countdown
3. Wait until T=120 seconds
4. Verify auto-analysis triggers automatically
5. Note new analysis appears in insights with timestamp

**Expected Result**:
```
[14:30:00] Auto-analysis:
System healthy, no errors.

[14:32:00] Auto-analysis:
(triggers automatically, no user click)
```

**Validation**:
- ✓ First auto-analysis within 122 seconds
- ✓ Subsequent auto-analyses every 120 ± 2 seconds
- ✓ No user intervention needed
- ✓ Timestamp header shows `Auto-analysis` (not Manual)

---

#### F2: Incremental Analysis (New Entries Only)

**Setup**: Track entries before and after heartbeat.

**Steps**:
1. Logs tab open, count total entries: 50
2. Wait for auto-analysis at T=120s
3. Verify analysis mentions "X new entries" (not 50 total)
4. Generate 2 new messages
5. Wait for next heartbeat at T=240s
6. Verify heartbeat skips (< 3 new entries)
7. Generate 2 more messages (total 4 new)
8. Wait for heartbeat at T=360s
9. Verify this heartbeat triggers (>= 3 new entries)

**Expected Result**:
```
[14:30:00] Auto-analysis:
Analyzed 17 new entries since last analysis (50 total in buffer).
No errors. Session is running normally.

[14:32:00] No auto-analysis (only 2 new entries, skipped)

[14:34:00] Auto-analysis:
Analyzed 4 new entries. One message response took 5.2 seconds.
```

**Validation**:
- ✓ Incremental logic works (fewer entries analyzed)
- ✓ Skip logic works (< 3 entries skipped)
- ✓ Analyses are much shorter (fewer entries = shorter prompt)

---

#### F3: Countdown Timer Accuracy

**Steps**:
1. Logs tab is open, view metrics dashboard
2. Note countdown: `⟳ Next analysis in 2m 00s`
3. Wait 10 seconds
4. Verify countdown shows `⟳ Next analysis in 1m 50s`
5. Wait until 2 seconds remain
6. Verify countdown shows `⟳ Next analysis in 0m 02s`
7. Wait for heartbeat to trigger
8. Verify countdown resets to `⟳ Next analysis in 2m 00s`

**Expected Result**:
- Countdown decrements exactly 1 second per update
- Accuracy: ±1 second

**Validation**:
- ✓ Timer updates every second (no skips)
- ✓ Timer resets after heartbeat
- ✓ Display format is consistent

---

### Category G: Edge Cases & Error Handling

#### G1: Analysis with No New Entries

**Steps**:
1. Logs tab, note timestamp of last entry
2. Wait for heartbeat trigger (no new messages sent)
3. Verify heartbeat silently skips (< 3 new entries)
4. Check that insights does NOT get a new analysis header

**Expected Result**:
- No new analysis added to insights
- Countdown resets silently
- No error logged

---

#### G2: Analysis Fails (Network Error Simulation)

**Steps**:
1. Disconnect network (disconnect WiFi, block port, etc)
2. Click `[⚡ Analyze]` button
3. Wait 30 seconds for timeout

**Expected Result**:
- Button remains in `[⟳ Analyzing…]` state OR
- Timeout error is caught, button re-enables
- App remains responsive
- User can retry or use other features

**Validation**:
- ✓ No crash or hang
- ✓ UI remains responsive

---

#### G3: Clear Logs Operation

**Steps**:
1. Logs tab is open, entries visible
2. Press `C` key
3. Verify all entries disappear
4. Verify metrics show total=0
5. Verify insights are cleared

**Expected Result**:
```
No entries — click a filter or send a message to log
```

**Validation**:
- ✓ All entries gone
- ✓ Metrics reset
- ✓ Selection reset to -1

**Note**: Currently no confirmation. User should add confirmation in a future PR.

---

#### G4: Scroll Offset with Few Entries

**Steps**:
1. Clear logs: press `C`
2. Send 1 message
3. Try to scroll up
4. Try to scroll down

**Expected Result**:
- Scroll has no visual effect (only 1 entry fits)
- No errors

---

#### G5: Entry Selected Then List Filtered

**Steps**:
1. Log tab, entry #5 is selected
2. Click `[Session]` filter (entries change)
3. Verify selected entry is reset (if not in filtered view)

**Expected Result**:
- selectedIdx resets to -1 (metrics view)
- Right column switches back to metrics

---

### Category H: Integration with Other Tabs

#### H1: Logs Accumulate Across Tab Switches

**Steps**:
1. Session tab: send 2 messages
2. Switch to Logs tab: verify 2 entries
3. Switch to Config tab (or another)
4. Switch back to Logs tab: verify entries still there
5. Go back to Session, send another message
6. Switch to Logs: verify 3 entries now

**Expected Result**:
- Logs persist across tab switches
- New entries from other tabs are captured

---

#### H2: Agent Run Creates Multiple Entries

**Steps**:
1. Logs tab is open
2. Session tab: trigger agent run (press F2, then `/run`)
3. Switch to Logs tab
4. Verify multiple entries appear:
   - `agent run started`
   - `[streaming status updates]`
   - `agent run ended`

**Expected Result**:
- At least 3 entries from single agent run
- Timestamps show progression
- Levels are correct (INFO for normal flow, ERROR if failed)

---

### Category I: Performance & Stress Tests

#### I1: 500+ Entries in Ring Buffer

**Setup**: Generate 500+ log entries (send ~50 messages, multiple analyses, etc).

**Steps**:
1. Ring buffer is at capacity (500 entries)
2. Send another message
3. Verify oldest entry is evicted (FIFO)
4. Rendering is still smooth

**Expected Result**:
- No lag when rendering
- No memory leak (check RSS memory)
- Scroll still works smoothly

---

#### I2: Rapid Filter Switching

**Steps**:
1. Logs tab is open
2. Rapidly click different filter chips: All → Session → Config → All → ...
3. Do this 20 times in 5 seconds

**Expected Result**:
- No visual glitch
- Rendering keeps up
- Final filter is correct

---

#### I3: Rapid Analysis Triggers

**Steps**:
1. Logs tab is open
2. Click `[⚡ Analyze]` button
3. Wait 2 seconds (before previous analysis completes)
4. Try to click again (should be blocked)
5. Wait for first analysis to complete
6. Click again
7. Repeat 3 times

**Expected Result**:
- Second click is ignored (button disabled)
- Each analysis completes without interference
- No overlapping responses

---

## Failure Checklist

If any of these indicators appear, investigation is needed:

| Indicator | Likely Cause | Debug Steps |
|-----------|-------------|------------|
| Mouse clicks on entries don't work | Mouse rect still wrong in app.ts | Check logsPanel.rect is set before onMouse dispatch |
| Entries appear with wrong level | Logger level filtering broken | Check MIN_LOG_LEVEL in logger.ts |
| Metrics show wrong counts | Filter not applied to computeMetrics | Verify getRecentLogs(selectedSource) is called |
| Countdown goes negative or doesn't update | setInterval issue | Check logsCountdownInterval is set correctly |
| Analysis never completes | Timeout or network issue | Check agentLoop promise resolution |
| Insights text is cut off or wrapped wrong | Text width calculation | Check wrapText() function in LogsPanel |
| Memory usage grows unbounded | Ring buffer not evicting | Verify MAX_ENTRIES is honored |
| Heartbeat doesn't trigger | setInterval not started | Check startLogsHeartbeat() called in start() |
| Rendered text has Unicode issues | Terminal doesn't support UTF-8 | Use terminal with full UTF-8 support |

---

## Test Report Template

```markdown
# Test Report: Logs Panel — [Date]

## Environment
- OS: [Linux/macOS/WSL2]
- Node: [version]
- Terminal: [terminal name + version]
- Screen: [columns] x [rows]

## Test Results

### Category A: UI Rendering & Mouse
- [ ] A1: Logs tab accessible  — PASS / FAIL / SKIP
- [ ] A2: Filter chips clickable — PASS / FAIL / SKIP
- [ ] A3: Entry selection — PASS / FAIL / SKIP
- [ ] A4: Scroll wheel (left) — PASS / FAIL / SKIP
- [ ] A5: Scroll wheel (right) — PASS / FAIL / SKIP

### Category B: Keyboard Navigation
- [ ] B1: Arrow keys — PASS / FAIL / SKIP
- [ ] B2: Filter cycling — PASS / FAIL / SKIP
- [ ] B3: Shortcuts — PASS / FAIL / SKIP

[... continue for all categories ...]

## Summary
- **Passed**: X/Y
- **Failed**: List any failures
- **Blockers**: Any critical issues?

## Notes
[Additional observations, environment issues, etc]
```

---

## Continuous Testing

### Pre-Commit Checklist

Before creating a PR, verify:
- [ ] `npm run build` succeeds with no TS errors
- [ ] `npm test` passes all 278+ tests
- [ ] Logs tab renders without artifacts
- [ ] Mouse clicks work on all interactive elements
- [ ] Manual analysis completes in <15 seconds
- [ ] Heartbeat triggers at correct interval

### CI/CD Pipeline

The following should pass on every push:
- TypeScript compilation (strict mode)
- Vitest suite (278 tests, 80%+ coverage)
- No console errors or warnings in e2e (when added)

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-06-09  
**Maintainer**: Matheus Lopes  

---

<a id="d2"></a>

## 2 · 2026-06-18 · End-to-End Test Guide — `factory` (Waves 0–5)

Source: [TESTING-FACTORY-E2E-2026-06-18.md](TESTING-FACTORY-E2E-2026-06-18.md) · [[TESTING-FACTORY-E2E-2026-06-18]]  ·  [↑ Index](#index)


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

---

