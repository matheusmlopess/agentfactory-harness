<!-- version: 1.0.0 -->
<!-- classification: SUMMARY -->
<!-- date: 2026-06-19 -->
<!-- last-updated: 2026-07-09 -->
<!-- status: ACTIVE -->
<!-- generated-by: scripts/docs-compile.sh -->

# TESTING — Memorial (Descriptive Compendium)

> **Auto-generated** by `scripts/docs-compile.sh` — **do not edit by hand**.
> Edit the source docs in `testing/` and re-run the script.
> Documents: **4** · ordered by creation date · each section links its source.

<a id="index"></a>
## Index

1. [Testing Guide: Logs Panel with Metrics Dashboard and Auto-Analysis](#d1) — `2026-06-09` — Complete end-to-end testing procedures for the Logs panel feature. · [[TESTING-LOGS-PANEL-2026-06-09]]
2. [End-to-End Test Guide — `factory` (Waves 0–5)](#d2) — `2026-06-18` — How to validate the implemented system end-to-end: preconditions, manual steps, expected · [[TESTING-FACTORY-E2E-2026-06-18]]
3. [TESTING — UI Consolidation + Studio: End-to-End Guide](#d3) — `2026-07-07` — How to verify `feature/ui-consolidation` end-to-end. Complements · [[TESTING-UI-CONSOLIDATION-STUDIO-2026-07-07]]
4. [TESTING — Canvas Session Binding + Wire Fix: End-to-End Guide](#d4) — `2026-07-09` — End-to-end test procedure for the 2026-07-08 canvas work: the `routeWire` · [[TESTING-CANVAS-SESSION-BINDING-2026-07-09]]

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

## A4 — Scenario matrix (mock-doc repos, every case)

Each row is an isolated throwaway git repo seeded with mock docs, then run through the agent's
scripts (and, for S10, an AgentFactory import). **10/10 pass.**

| # | Scenario | Setup | Result |
|---|---|---|---|
| S1 | **Clean / blank repo** (no docs, no agent) | empty repo + `.docs-system.conf` | bootstrap installs 6 governance docs + folders + scripts + rule; migrate = 0 moves ✅ |
| S2 | Loose docs, no agent | `FEATURE-X.md`, `TESTING-X.md` | → `features/…-DATE`, `testing/…-DATE` ✅ |
| S3 | Mixed known + unknown prefixes | `FEATURE-A.md`, `RANDOMNOTES.md` | known planned; unknown → **NEEDS-REVIEW** (not moved) ✅ |
| S4 | Governance docs at root | `DOCUMENTATION-TAXONOMY.md`, `GLOSSARY.md` | → `documentation/` (keep name) ✅ |
| S5 | Idempotency | already-foldered + dated doc | migrate = 0 moves; `compile` twice → identical md5 ✅ |
| S6 | Bootstrap idempotency | run bootstrap twice (+ edited registry) | registry **not clobbered**, rule **not duplicated** ✅ |
| S7 | Revert | compile then `--clean` | MEMORIAL created then removed ✅ |
| S8 | Empty `docs/` edge | empty `docs/` | no crash (migrate/compile exit 0) ✅ |
| S9 | Collision (guarded) | two docs → same `stem+date` | both flagged **NEEDS-REVIEW**, 0 moves, both originals survive — **fixed v1.0.2** (see note) ✅ |
| S10 | **AgentFactory import into a clean repo** (no `.ai/`, no agents) | `import <bundle.zip>` | auto-creates `.ai/`; imports **4 skill, 4 command, 1 doc, 4 script** ✅ |

> **S9 — collision guard (fixed in docs-system v1.0.2):** `docs-migrate.sh` derives the target as
> `TYPE-NAME-DATE.md`; if two source docs resolve to the **same** target, neither is moved — both
> are listed `NEEDS-REVIEW` with a `[collision -> target]` note, so the later `git mv` can no longer
> silently overwrite the earlier file. (A `docs-system` issue, not `agentfactory-gen`.)

## A5 — Gaps found → tracked

**`agentfactory-gen` (filed: [AgentFactory#179](https://github.com/matheusmlopess/AgentFactory/issues/179)):**

| # | Gap | Sev |
|---|---|---|
| 1 | `import --from-git` drops declared skills/commands/docs (imports **scripts only** — auto-retrofit regenerates its own manifest) | 🔴 |
| 2 | `import --from-git` rejects **local** filesystem paths (URL schemes only) | 🟠 |
| 3 | No `pack`/`wrap` command to emit an importable bundle ZIP | 🟠 |
| 4 | `import --dry-run` is not read-only — **prompts & aborts** | 🟡 |
| 5 | (UX) no `import-agent` alias | 🟡 |

Verified working (not gaps): bundle-ZIP import = full agent; import into a clean repo with **no
`.ai/`** auto-creates the harness; `--allow-scripts` skips the scripts gate.

**`docs-system` kit:** S9 collision guard — **fixed in v1.0.2** (colliding targets → NEEDS-REVIEW).

---

<a id="d3"></a>

## 3 · 2026-07-07 · TESTING — UI Consolidation + Studio: End-to-End Guide

Source: [TESTING-UI-CONSOLIDATION-STUDIO-2026-07-07.md](TESTING-UI-CONSOLIDATION-STUDIO-2026-07-07.md) · [[TESTING-UI-CONSOLIDATION-STUDIO-2026-07-07]]  ·  [↑ Index](#index)


<!-- version: 1.0.0 -->
<!-- classification: TESTING -->
<!-- date: 2026-07-07 -->
<!-- last-updated: 2026-07-07 -->

How to verify `feature/ui-consolidation` end-to-end. Complements
`TESTING-FACTORY-E2E-2026-06-18.md` (Waves 0–5 surfaces); this guide covers the surfaces
that changed: input/keymap, theming/a11y, size profiles, dividers, the studio canvas,
the team dashboard, and NDJSON automation.

---

## 0. Preconditions

```
┌─ Required ────────────────────────────────────────────────────────────────┐
│ • Node ≥ 20, npm install done in the worktree                             │
│ • A real terminal ≥ 120×40 for manual steps (alt-screen, SGR mouse,       │
│   256-color); tmux for the scripted smoke                                 │
│ • Repo: ~/repo/worktrees/ui-consolidation (branch feature/ui-consolidation)│
├─ Optional ────────────────────────────────────────────────────────────────┤
│ • ANTHROPIC_API_KEY for a real plan run (§6 works WITHOUT a key too —     │
│   error/skip paths are part of the test)                                  │
│ • Start clean: no ./af-plan.json in cwd; optionally move                  │
│   ~/.config/agentfactory/config.json aside to test first-run defaults     │
└────────────────────────────────────────────────────────────────────────────┘
```

## 1. Automated gates (run first — 5 min)

| # | Command | Expected |
|---|---|---|
| 1 | `npx tsc --noEmit` | no output (strict, no `any`) |
| 2 | `npm test` | **413 passed**, 0 failed |
| 3 | `./scripts/smoke-tui.sh` | `smoke-tui: all checks passed` (13 checks incl. a real 60×20 guard-screen session) |
| 4 | `npx tsx src/index.ts --version` | matches `package.json` `"version"` exactly |

Failure indicators: any tsc output; any red test; smoke `FAIL:` lines (each names the
missing pane content); a version mismatch (means `getVersion()` resolution broke).

## 2. Input, keymap & help

Launch `npx tsx src/index.ts` in a ≥120×40 terminal.

| Step | Expected | Validates |
|---|---|---|
| Press `F1`…`F6` in order | each tab activates — **F6 must reach Logs** (panel shows `Metrics`, not just the tab label) | F6 keyboard fix; keymap tab bindings |
| Press `Tab` repeatedly from Session | cycles orchestration → agents → terminal; on Terminal, Tab types into the shell instead | tab cycle + raw bypass boundary |
| On Logs press `?` | "Keyboard Shortcuts" overlay: Global section + "Logs tab" section (j/k/h/l/c/a listed); ↑/↓ scrolls; Esc closes | help overlay, keymap `list()` |
| On Session type `?` in the input | `?` appears in the chat input — **no** help overlay | text-input suppression |
| On Logs press `j`/`k`, `h`/`l`, `c` | selection moves, source chips cycle, buffer clears | vim keys as keymap contributions |
| In Terminal: type `ls`, `Ctrl+P`, Esc, `⇧PgUp` | shell works; palette opens/closes without leaking to the PTY; scrollback scrolls | bypass byte table |
| Wheel over the Session transcript vs the Config list | transcript jumps 3 lines/tick; Config list moves the viewport 1 row/tick, selection unchanged | wheel conventions |

## 3. Theme, motion, size profiles, dividers

| Step | Expected | Validates |
|---|---|---|
| `Ctrl+P` → "Theme: high contrast" | white-on-black, yellow focus borders, cyan tabs — applies instantly | live token swap |
| `F5` → Interface → Enter on "Theme" | value cycles `[default ▸]` ↔ `[high-contrast ▸]`, applies + persists | Config settings UI |
| Restart the app | theme still high-contrast | settings persistence |
| Toggle "Reduced motion", open Config → login overlay | spinner is a static `●` (no animation); Logs countdown stops ticking | reduced motion |
| `Ctrl+P` → "Size profile: Standard (110×30)", then shrink the terminal below 110×30 | guard screen `⚠ Terminal too small · current …× · minimum 110×30 (standard)`; `Ctrl+P` still opens; picking Compact restores the UI without resizing | guard + input-behind-guard recovery |
| Drag the border between Session and the right column; release; restart | split ratio changed, persists across restart | dividers + persistence |
| Check `~/.config/agentfactory/config.json` | `"settings"` contains `theme`, `sizeProfile`, `layout.sessionRatio` etc.; `"keys"` untouched | storage shape |

## 4. Consolidated widgets (modals, lists, menus)

| Step | Expected |
|---|---|
| Session: click the Session tab while on it → new-session menu; press Esc; reopen; click **outside** the frame | both dismiss it (Esc + click-outside convention) |
| Session: click `[model]` in the status bar | switches to Session + opens the picker; Esc steps back (model→provider) then closes; reopening within 5 min is instant (cache) |
| Config: Enter on a provider → edit modal; Esc cancels (no save); type a key + Enter → `sk-…▓▓▓▓ [set]` shown | Overlay migration + unified masking |
| Orchestration: right-click a block → menu; click a menu **item** | the item executes (items are clickable now); clicking elsewhere or Esc dismisses |

## 5. Studio end-to-end (the core new scenario)

In an **empty directory** (no af-plan.json), run the app, press `F2`:

1. `t` → toolbox appears. Click `worker`, click an empty cell → node drops **and the
   inspector opens**. Set `id` to `build`, prompt to `Build it`, Enter. Expected: `✓ valid`
   then the modal closes; block titled `build`.
2. Repeat for a `reviewer` node `review` (prompt `Review it`).
3. Drag `build`'s right-edge `○` to `review`'s left-edge `●` → connector menu. Pick
   **handoff: summary**. Expected: wire renders `══[H]══`, not `────`.
4. Try wiring `build → review` again → **no menu** (duplicate rejected). Wire `review → build`
   and pick dependency → now press `Ctrl+S`. Expected: red status-bar error `Plan invalid:
   Cycle: …`. Right-click that wire → Delete wire.
5. `Ctrl+S` → then in a shell:

```
$ cat af-plan.json | head            # valid plan + "x-studio" block
$ npx tsx src/index.ts plan validate # → Plan "untitled" is valid (2 steps)
$ grep -A2 '"x-studio"' af-plan.json # layout rows/cols + edges with "kind"
$ grep 'Input from build' af-plan.json  # handoff scaffold appended to review's prompt
```

6. Quit, relaunch in the same directory → **the same graph reappears at the same
   positions** (x-studio round-trip).
7. `Ctrl+R` → blocks go `◎ → ● → ✓` (with a key) or `✗`/`⊘` (without). `F3` → team
   dashboard shows `Team — untitled [n running / 2 total]`, glyph+text rows, the event
   log streaming, and the failed step's error in red when key-less. Esc returns to sessions.
8. Rename test: select `build` (click body), press `e`, change id to `builder`, Enter →
   the wire follows (`builder ══▶ review`), no dangling edge on `Ctrl+S`.

## 6. Automation contract

```
$ npx tsx src/index.ts run --json > events.ndjson; echo "exit=$?"
$ head -1 events.ndjson | python3 -m json.tool     # parses; has type/stepId/status/ts
```
Expected: one JSON object per line on **stdout** only; ISO `ts` on every event;
`exit=1` iff any `step:error` occurred (verify by running key-less), else `exit=0`.

## 7. Correctness confirmation checklist

```
┌─ The implementation is correct when ALL of these hold ─────────────────────┐
│ □ §1 gates green (tsc / 413 tests / 13 smoke checks / version match)       │
│ □ F6 reaches Logs by keyboard; `?` help lists per-tab bindings             │
│ □ Esc AND click-outside dismiss every modal/menu/palette/help              │
│ □ Theme/motion/size/dividers apply live AND survive restart                │
│ □ Guard screen appears below the profile minimum and never traps input    │
│ □ Studio: invalid designs (cycle/dup/empty) blocked at save/run with a     │
│   visible reason; valid designs round-trip through af-plan.json byte-     │
│   stable and pass `factory plan validate`                                  │
│ □ Run statuses show ◎/●/✓/✗/⊘ with text labels (glyphs, not color-only)   │
│ □ run --json: NDJSON stdout, human stderr, exit code reflects failures    │
│ □ Sessions mode of the Agents tab is unchanged (incl. laureate tooltip)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8. Common failure indicators & first moves

| Indicator | Likely cause | First move |
|---|---|---|
| Smoke FAIL on startup checks only | tsx cold-start slower than the poll window | re-run; check `npx tsx src/index.ts` starts at all |
| Keys "do nothing" after a modal | a transient consumed input | Esc (possibly twice); check `?` works |
| Wire won't complete | released on a non-port cell | drop exactly on the `●` (left edge, row 2 of the block) |
| `Ctrl+S` silently "does nothing" | validation failed | read the red status-bar message (5 s); fix, retry |
| Guard screen at a normal size | `settings.sizeProfile` set to wide | Ctrl+P → Compact |
| NDJSON mixed with human text | stdout/stderr not separated by the harness | redirect only stdout (`>`), keep stderr on the tty |
| Tests fail only on `store` mocks | mock missing `getSetting`/`setSetting` | mirror `ConfigPanel.test.ts`'s store mock |

---

<a id="d4"></a>

## 4 · 2026-07-09 · TESTING — Canvas Session Binding + Wire Fix: End-to-End Guide

Source: [TESTING-CANVAS-SESSION-BINDING-2026-07-09.md](TESTING-CANVAS-SESSION-BINDING-2026-07-09.md) · [[TESTING-CANVAS-SESSION-BINDING-2026-07-09]]  ·  [↑ Index](#index)

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

---

