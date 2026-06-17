<!-- version: 1.0.0 -->
# Feature: Live Logs Panel with Metrics Dashboard and Auto-Analysis

Complete operational and feature documentation for the Logs tab in AgentFactory Harness.

---

## Overview

The **Logs Panel** (Tab 6) provides real-time visibility into application activity with:
- **Live log streaming** from all panels (Session, Config, Agents)
- **Metrics dashboard** showing entry counts, level distribution, and source breakdown
- **Automatic 2-minute analysis** with incremental updates (only new entries analyzed)
- **Full mouse support** for filtering, selection, and interaction
- **Timestamped insights** preserving analysis history

**Access**: Press `F6` to switch to the Logs tab.

---

## Architecture

### Component Layout

```
╔════════════════════════════════════════════════════════════════════════════╗
║ LOGS TAB ─────────────────────────────────────────────────────────────────░
╠════════════════════════════════════════════════════════════════════════════╣
║ [All] [Session] [Config] [Agents]  ◄─── Filter chips (source selector)    ║
╠════════════════════════════════════════════════════════════════════════════╣
║                          │                                                  ║
║  LOG ENTRIES             │       METRICS / DETAIL / INSIGHTS                ║
║  (40% width)             │       (60% width)                                ║
║                          │                                                  ║
║ 14:32:05 INFO Session   │       ─ Metrics ──────────── [⚡ Analyze] ─      ║
║ 14:32:04 WARN Config    │       Total: 47 entries  Rate: 2.3/min           ║
║ 14:31:59 ERROR App      │       By Level:                                   ║
║ ...                     │       INFO  ████████████ 38                       ║
║                         │       WARN  ████          8                       ║
║ (↑↓ scrollable)         │       ERROR █             1                       ║
║                         │       By Source:                                  ║
║                         │       Session  31  ██████████                     ║
║                         │       Config    9  ███                            ║
║                         │       App       7  ██                             ║
║                         │                                                  ║
║                         │       ─ Insights ────────────────────────────────║
║                         │       [14:30:15] Auto-analysis:                  ║
║                         │       No errors in last 2 min. System is        ║
║                         │       running smoothly with steady log rate.    ║
║                         │       ⟳ Next analysis in 1m 47s                 ║
║                         │                                                  ║
╚════════════════════════════════════════════════════════════════════════════╝
```

### State Machine

```
      ┌──────────────────────────────────────────┐
      │      NO ENTRY SELECTED (Default)         │
      │  selectedIdx = -1                        │
      │  Right column shows METRICS DASHBOARD    │
      └──────────────────────────────────────────┘
               ▲                          │
               │                          │ User clicks log entry
               │                          ▼
      ┌──────────────────────────────────────────┐
      │      ENTRY SELECTED                      │
      │  selectedIdx >= 0                        │
      │  Right column shows ENTRY DETAIL         │
      └──────────────────────────────────────────┘
               ▲                          │
               │                          │ User clicks different entry or
               │                          │ presses 'Up'/'Down' with no entry
               └──────────────────────────┘
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER INTERACTIONS (All Panels)                                  │
│ • SessionPanel: message sent, agent run started/ended, ...      │
│ • ConfigPanel: API key saved, login triggered, ...              │
│ • AgentsPanel: session selected, list updated, ...              │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Logger Instance (per panel): logger('Session'), logger('Config') │
│ • Level: DEBUG, INFO, WARN, ERROR                               │
│ • Metadata: structured fields (name, count, error, etc)         │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Ring Buffer (src/core/logger.ts)                                │
│ • Max 500 entries, FIFO eviction                                │
│ • LogEntry: timestamp, level, source, message, meta             │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ LogsPanel Render                                                 │
│ 1. Fetch entries: getRecentLogs(selectedSource)                 │
│ 2. Compute metrics: byLevel, bySource, errorCount, etc          │
│ 3. Display left: log entries (scrollable)                       │
│ 4. Display right: metrics dashboard OR entry detail             │
│ 5. Display insights: timestamped analysis history               │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2-Minute Heartbeat (in App.ts)                                  │
│ • Every 120 seconds: runLogsAnalysis(auto=true)                 │
│ • Incremental: filter entries since lastAnalyzedAt              │
│ • Skip if < 3 new entries                                       │
│ • Stream LLM analysis into LogsPanel.insightsText               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflows

### Workflow 1: View Live Logs — Happy Path

**Precondition**: App is running, F6 pressed to show Logs tab.

**Steps**:
1. User sends a message in Session tab
2. SessionPanel logs: `log.info('message sent', { length, chatMode })`
3. Entry appears in Logs left column under "Session" source
4. Right column updates metrics (Total count increases)
5. User switches back to Session to continue chatting
6. Each interaction updates the log buffer and metrics in real-time

**Expected Result**:
- New log entries appear immediately in left column
- Metrics update: total count increments, bar charts adjust
- No errors or blocking

**Validation**:
- ✓ Timestamp is within 1 second of current time
- ✓ Source matches the logging panel
- ✓ Level is one of: DEBUG, INFO, WARN, ERROR
- ✓ Message is non-empty string

---

### Workflow 2: Filter Logs by Source — Happy Path

**Precondition**: Logs tab is open, multiple sources have entries.

**Steps**:
1. User clicks `[All]` chip (always on)
2. All entries from all sources display
3. User clicks `[Session]` chip
4. Only entries with source="Session" display
5. Metrics recompute for filtered entries only
6. User clicks another source `[Config]`
7. Filtered list updates, metrics recompute

**Expected Result**:
- Chip highlights to show selection
- Left column updates immediately with filtered entries
- Metrics dashboard recalculates counts based on filter
- No entries lost; filtering is non-destructive

**Validation**:
- ✓ Selected chip has highlighted background/foreground
- ✓ Unselected chips return to normal colors
- ✓ Filtered metrics match entry count for that source

---

### Workflow 3: View Entry Details — Happy Path

**Precondition**: Logs tab is open, at least one entry is visible.

**Steps**:
1. User clicks on a log entry in the left column
2. Entry highlights in the left column
3. Right column switches from metrics dashboard to entry detail
4. Detail shows: Time, Level, Source, Message, Meta (if present)
5. Insights section appears at bottom with previous analysis
6. User clicks different entry → right column updates to new entry detail
7. User presses `↑` / `↓` to navigate between entries while viewing details

**Expected Result**:
- Clicked entry is highlighted (color change)
- Right column immediately shows full entry details
- All fields are visible and properly formatted
- Insights preserved (not cleared)

**Validation**:
- ✓ selectedIdx matches clicked entry index
- ✓ Entry detail shows all non-empty fields
- ✓ Meta is formatted as valid JSON if present

---

### Workflow 4: Manual Analysis (Analyze Button) — Happy Path

**Precondition**: Logs tab is open, at least 3 entries present.

**Steps**:
1. User clicks `[⚡ Analyze]` button in right column header
2. Button changes to `[⟳ Analyzing…]` (disabled)
3. `isInsightsStreaming` becomes true
4. LLM prompt is constructed from last 50 entries (or filtered entries)
5. AgentLoop streams response into LogsPanel.insightsText
6. Insights appear line-by-line in the insights section
7. After stream ends, button returns to `[⚡ Analyze]`
8. `isInsightsStreaming` becomes false
9. Analysis is timestamped: `[HH:MM:SS] Manual analysis:`

**Expected Result**:
- Button state transitions correctly
- Analysis streams appear in real-time
- Previous analyses are preserved (not cleared)
- No input is accepted while analyzing

**Validation**:
- ✓ Button changes state immediately on click
- ✓ LLM response starts within 1-2 seconds
- ✓ Button re-enables after stream completes
- ✓ Timestamp is accurate (within 1 second)

---

### Workflow 5: Auto-Analysis Heartbeat — Happy Path

**Precondition**: App is running with Logs tab, logged interactions exist.

**Steps**:
1. App starts and begins 2-minute countdown
2. Metrics dashboard shows: `⟳ Next analysis in 1m 59s`
3. Countdown updates every second
4. At T=120s, runLogsAnalysis(auto=true) triggers automatically
5. Only NEW entries since last analysis are fetched
6. If < 3 new entries, analysis is skipped (no noise)
7. If >= 3 new entries:
   - `startInsights(auto=true)` prepends: `[HH:MM:SS] Auto-analysis:`
   - LLM analyzes only the new entries (much shorter prompt)
   - Insights stream into the insights section
   - `logsLastAnalyzedAt` is updated to analysis end time
8. Countdown resets to 120 seconds
9. Cycle repeats

**Expected Result**:
- Countdown visible and accurate (±1 second)
- Auto-analysis triggers without user interaction
- Only new entries analyzed (incremental)
- Insights history preserved (last 3 analyses visible)
- No blocking or UI freeze during analysis

**Validation**:
- ✓ Countdown increments as expected
- ✓ First auto-analysis triggers within 122 seconds of startup
- ✓ Subsequent analyses trigger every 120 seconds (±2s)
- ✓ Skip logic works: no analysis if new entries < 3
- ✓ Timestamp header shows in insights
- ✓ Analysis completes and button re-enables

---

### Workflow 6: Scroll Through Long Log Lists — Edge Case

**Precondition**: Logs tab is open, 200+ entries accumulated.

**Steps**:
1. User mouse-wheels UP on left column
   - Scroll offset increases (viewing older entries)
2. User mouse-wheels DOWN
   - Scroll offset decreases (viewing newer entries)
3. Auto-scroll behavior: When a new entry is added, scrollOffset resets
   - User sees the newest entry (like tail -f)
4. User manually scrolls UP to view old entries
   - New entries still arrive but list stays at user's scroll position
   - Until user scrolls DOWN to bottom again

**Expected Result**:
- Scroll responds immediately and smoothly
- List shows correct entries for scroll offset
- New entries auto-scroll to bottom when at bottom, stay put when scrolled up
- No lag or visual glitch

**Validation**:
- ✓ Scroll offset is within [0, max]
- ✓ Visible entries match offset calculation
- ✓ Entry count is correct
- ✓ Auto-scroll only happens when viewing newest entries

---

### Workflow 7: Clear All Logs — Dangerous Operation

**Precondition**: Logs tab is open, entries are present.

**Steps**:
1. User presses `C` (clearLogBuffer hotkey)
2. Confirmation dialog: `Clear all logs? (y/n)` — NOT YET IMPLEMENTED
3. If user presses `Y`:
   - Ring buffer is cleared
   - Insights text is cleared
   - Filter resets to [All]
   - Selection resets to -1 (metrics view)
   - Countdown resets
4. Logs tab is now empty

**Expected Result**:
- All entries gone
- Metrics show 0
- Insights cleared
- View is clean slate

**Validation**:
- ✓ getRecentLogs() returns empty array
- ✓ Metrics show total=0

**Note**: Currently `C` clears without confirmation. Add confirmation dialog in future PR.

---

### Workflow 8: Error Handling — Network Failure During Analysis

**Precondition**: User clicks Analyze, but network is unavailable.

**Steps**:
1. User clicks `[⚡ Analyze]`
2. Button changes to `[⟳ Analyzing…]`
3. LLM request fails (network timeout, auth failure, etc)
4. Error is caught in try/finally block
5. `finishInsights()` is called (button re-enables)
6. Error message is logged to Logs (source="App")
7. User is NOT blocked; can try again or use other features

**Expected Result**:
- Button re-enables (doesn't hang)
- Error appears in log buffer
- User can retry analysis or continue using app

**Validation**:
- ✓ Button returns to enabled state
- ✓ Error logged as ERROR level
- ✓ App remains responsive

---

## Keyboard & Mouse Interaction

### Keyboard Shortcuts (LogsPanel)

| Key | Action | Behavior |
|-----|--------|----------|
| `↑` or `K` | Previous entry | Move up in filtered list; if at top, deselect (show metrics) |
| `↓` or `J` | Next entry | Move down in filtered list; if at bottom, deselect (show metrics) |
| `←` or `H` | Previous source | Switch filter left (All → ... → Session) |
| `→` or `L` | Next source | Switch filter right (Session → ... → All) |
| `A` | Analyze | Trigger manual analysis (if not already streaming) |
| `C` | Clear logs | Clear all entries and insights (⚠️ no confirmation yet) |
| Other | Ignored | No other keys have effects in Logs tab |

### Mouse Interactions

| Action | Region | Behavior |
|--------|--------|----------|
| **Left click** | Filter chip | Switch to that source |
| **Left click** | Log entry | Select that entry (show detail in right column) |
| **Left click** | Analyze button | Trigger manual analysis |
| **Scroll wheel UP** | Left column | Scroll log list up (older entries) |
| **Scroll wheel DOWN** | Left column | Scroll log list down (newer entries) |
| **Scroll wheel UP** | Right column (insights) | Scroll insights text up |
| **Scroll wheel DOWN** | Right column (insights) | Scroll insights text down |
| **Mouse move** | Left column | Hover (no visual feedback yet, reserved for future tooltips) |

---

## Logging Instrumentation

### Panel Logger Points

#### SessionPanel
```typescript
log.info('session created', { name: laureate.name, total: sessions.length })
log.debug('message sent', { length: text.length, chatMode: boolean })
log.info('agent run started', { model: string, chatMode: boolean })
log.info('agent run ended', { turns: number, inputTokens: n, outputTokens: n })
log.error('agent run failed', { error: message })
log.info('chat mode toggled', { chatMode: boolean })
log.debug('session switched', { to: sessionName })
```

#### ConfigPanel
```typescript
log.info('api key saved', { provider: 'anthropic' | 'openai' })
log.info('login triggered', { provider: 'agentfactory' })
log.info('logout triggered', {})
log.info('key import triggered', {})
```

#### AgentsPanel
```typescript
log.debug('session selected', { name: sessionName })
log.debug('agent list updated', { count: number })
```

#### App
```typescript
log.info('render started', {})
log.info('input listener started', { logFile: filePath })
// Tab switches, plan runs, etc
```

---

## Metrics Computation

```typescript
interface Metrics {
  total: number                    // Total entries in filtered view
  byLevel: Record<'DEBUG' | 'INFO' | 'WARN' | 'ERROR', number>
  bySource: Array<[string, number]>   // Sorted by count desc
  errorCount: number               // Errors only
  recentErrors: LogEntry[]         // Last 5 errors (if any)
}
```

### Algorithm

1. **Input**: `getRecentLogs(selectedSource)` — all entries or filtered by source
2. **Count by level**: Loop entries, increment counter for each level
3. **Count by source**: Accumulate source counts in a Map
4. **Sort sources**: Convert Map to array, sort by count descending
5. **Recent errors**: Filter for ERROR level, take last 5
6. **Return**: Metrics object

**Time Complexity**: O(n) where n = number of entries (max ~500 in ring buffer)
**Space Complexity**: O(m) where m = number of unique sources (typically 4-8)

---

## Insights History

Insights are **appended**, not cleared:

```
[14:30:15] Manual analysis:
No errors in last 30 seconds. Session is running smoothly with average message latency of 450ms.

[14:32:15] Auto-analysis:
One WARNING detected: agent response took 8.3 seconds. Recommend checking model latency. Overall system health is stable.

[14:34:15] Manual analysis:
3 API key saves detected. Session switcher activity is normal.
⟳ Next analysis in 1m 44s
```

### Preservation Logic

- `startInsights(auto)` prepends a timestamped header (`[HH:MM:SS] Auto/Manual analysis:`)
- `appendInsights(delta)` adds LLM streaming text
- Text accumulates (not cleared between analyses)
- When rendered, insights section shows the **last N lines** that fit in the visible area
- If text exceeds ~5000 characters, older analyses may be trimmed (not yet implemented, can be added)

---

## Configuration

### Ring Buffer (Logger)

File: `src/core/logger.ts`

```typescript
const MAX_ENTRIES = 500      // Max log entries in buffer
const MIN_LOG_LEVEL = 'INFO' // Only log this level and higher
```

### Heartbeat Interval

File: `src/app.ts`

```typescript
const HEARTBEAT_MS = 2 * 60 * 1000   // 120 seconds
```

### Analysis Thresholds

File: `src/app.ts`

```typescript
const MIN_NEW_ENTRIES = 3    // Skip auto-analysis if fewer new entries
const SAMPLE_SIZE = 50       // Max entries sent to LLM
```

All can be adjusted by modifying constants and rebuilding.

---

## Error Handling & Recovery

### Mouse Click on Non-Existent Entry

**Scenario**: User clicks a row, but entry doesn't exist at that index.

**Behavior**:
```typescript
if (clickedEntryIdx >= 0 && clickedEntryIdx < entries.length) {
  this.selectedIdx = clickedEntryIdx
  this.onUpdate()
}
// Else: silent ignore, selectedIdx unchanged
```

**Result**: No error, selection unchanged.

---

### Filter Chip Click with No Entries

**Scenario**: User clicks `[Config]` but ConfigPanel has never logged.

**Behavior**:
- `getRecentLogs('Config')` returns empty array
- Metrics shows total=0
- Left column is blank
- Right column shows metrics dashboard with all zeros
- `[⚡ Analyze]` button is disabled (no entries to analyze)

**Result**: App remains responsive; user can click a different chip.

---

### Analysis Fails (Network Error)

**Scenario**: User clicks Analyze, but agentLoop throws error.

**Behavior**:
```typescript
try {
  for await (const e of agentLoop(session, { adapter })) {
    // ...
  }
} finally {
  this.logsPanel.finishInsights()  // ← Always called
  this.scheduleRender()            // ← Ensure UI updates
}
```

**Result**:
- Button re-enables
- Partial analysis (if any) is preserved in insights
- Error is NOT logged to logs (to avoid confusion)
- User can try again

---

### Analysis Timeout

**Scenario**: LLM hangs (no response for >30 seconds).

**Behavior**:
- AgentLoop has no timeout mechanism yet
- User must manually interrupt (Ctrl+C) or kill process
- After restart, analysis history is lost

**Mitigation**: Add per-prompt timeout in future PR.

---

### Scroll Offset Exceeds Buffer

**Scenario**: User scrolls up, then entries expire from ring buffer.

**Behavior**:
```typescript
const start = Math.max(0, entries.length - leftListRows - this.scrollOffset)
// Clamps to valid range
```

**Result**: Display adapts gracefully; no crash or blank lines.

---

## Failure Modes & Prevention

| Failure | Root Cause | Prevention |
|---------|-----------|-----------|
| Mouse click on empty Logs tab | No entries logged | SessionPanel logs on startup ✓ |
| Metrics show wrong counts | Filter not applied | Filter applied before computeMetrics ✓ |
| Insights grow unbounded | No trimming | Will add trim logic in future |
| Heartbeat doesn't fire | setTimeout vs setInterval confusion | Using setInterval ✓ |
| Log level filtering broken | MIN_LOG_LEVEL changed externally | All logging uses hardcoded 'INFO' or higher ✓ |
| Countdown goes negative | Calculation error | Using Math.max(0, countdown - 1) ✓ |
| Memory leak in listeners | setInterval not cleared | Cleared in stop() method ✓ |

---

## Testing Checklist

- [ ] Mouse clicks work on all filter chips
- [ ] Mouse clicks work on log entries
- [ ] Mouse clicks work on Analyze button
- [ ] Scroll wheel works on left (logs) and right (insights)
- [ ] Keyboard navigation (↑↓←→) works
- [ ] Keyboard shortcuts (A, C, H, J, K, L) work
- [ ] Live logs appear as operations happen
- [ ] Metrics update correctly when filtering
- [ ] Metrics show correct counts (total, by-level, by-source)
- [ ] Manual analysis streams and completes
- [ ] Auto-analysis triggers every ~120 seconds
- [ ] Auto-analysis incremental logic (new entries only)
- [ ] Countdown timer updates every second
- [ ] Insights history preserved (last 3 analyses)
- [ ] Clear logs operation works (after adding confirmation)
- [ ] Error during analysis doesn't freeze UI
- [ ] App shutdown closes heartbeat timer gracefully

---

## Future Enhancements

### Short-term (Next Sprint)

1. **Confirmation dialog for clear**: Prevent accidental data loss
2. **Error timeout**: Add 30s timeout to analysis to prevent hanging
3. **Insights trimming**: Keep only last 3 analyses (5000 char limit)
4. **Search/filter by message**: Find logs containing a keyword
5. **Export logs**: Copy filtered logs to clipboard or file

### Long-term (Post-Release)

1. **Persistent log storage**: SQLite backend for historical analysis
2. **Alerts**: Trigger notifications on ERROR level entries
3. **Metrics graphs**: Show rate over time (last hour, last day)
4. **Log rotation**: Automatic archival of old log files
5. **Structured queries**: Search by source, level, timestamp range
6. **Remote log aggregation**: Stream logs to external service (e.g., Datadog)
7. **Performance profiling**: Analyze which operations are slow from logs
8. **Audit trail**: Immutable log signing for compliance

---

## References

- **Logger implementation**: `src/core/logger.ts`
- **LogsPanel component**: `src/tui/panels/LogsPanel.ts`
- **App integration**: `src/app.ts` (lines 312–355 for runLogsAnalysis)
- **Tests**: `src/tui/panels/*.test.ts` (add LogsPanel.test.ts in future)

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-06-09  
**Maintainer**: Matheus Lopes  
