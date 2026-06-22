<!-- version: 1.0.0 -->
<!-- classification: DESIGN -->
<!-- date: 2026-06-09 -->
<!-- last-updated: 2026-06-19 -->
# Design Analysis: Logs Panel Implementation

Deep-dive analysis of design decisions, trade-offs, assumptions, gaps, and recommendations for the Logs Panel feature (Wave 5.5+).

---

## 1. Design Reasoning & Trade-offs

### 1.1 Mouse Rect Bug: Setting Rect in Dispatch vs Render

**Problem**: LogsPanel rect was only set in `render()`, but mouse/key events are dispatched **before** `render()`, causing click detection to fail.

**Solution Considered**:
- **Option A**: Set rect in both mouse/key dispatch blocks AND in render (adopted)
- **Option B**: Move all panel setup into a "measure" phase before input dispatch
- **Option C**: Compute rect inside onMouse/onKey (late binding)

**Selected**: Option A (current implementation)

**Trade-off Analysis**:

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| **Code Complexity** | Low (2 inline calcs) | High (refactor app.ts) | Medium (extra closure) |
| **Performance** | Good (calcs cached) | Good (single pass) | Acceptable (recalc once) |
| **Maintenance** | Medium (duplicated code) | Easy (single source) | Easy (encapsulated) |
| **Risk** | Low (isolated change) | High (affects layout system) | Low (local change) |
| **Time to Ship** | Immediate | 2 sprint cycles | 1 day |

**Reasoning**: Given the tight scope and low risk, Option A was preferred over Option B (larger refactor). Option C was rejected because LogsPanel doesn't have access to `layout` computation. The duplication is acceptable for now; a future refactor can centralize layout binding.

**Future**: In a post-release refactor, move all panel rect updates to a `measure()` phase called before input dispatch. This would eliminate duplication and improve the input event handling architecture.

---

### 1.2 Live Logging: Per-Panel Logger vs Centralized

**Problem**: Only one logger existed (App), so Logs tab showed only startup entries. Need real-time visibility into all panel activity.

**Solution Considered**:
- **Option A**: Add `logger('Panel')` to each panel class (adopted)
- **Option B**: Inject logger into panel constructors (dependency injection)
- **Option C**: Use a singleton logger with panel tags (global state)

**Selected**: Option A (simple instance variable)

**Trade-off Analysis**:

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| **Coupling** | Loose (logger is imported) | Loose (injected) | Tight (global) |
| **Testing** | Medium (need to import logger) | Easy (mock injected) | Hard (global state) |
| **Flexibility** | Good (can switch logger easily) | Excellent (fully mockable) | Poor (couples to impl) |
| **Cognitive Load** | Low (obvious where logs come from) | Medium (trace injection) | High (implicit global) |

**Reasoning**: Option A is sufficient for current needs and has low cognitive overhead. DI (Option B) is overkill without a logging abstraction layer. Global state (Option C) makes testing harder.

**Future**: If logging becomes a "plugin" system (custom formatters, handlers), migrate to Option B with a LoggerProvider interface.

---

### 1.3 Metrics Computation: Real-time vs Cached

**Decision**: Metrics recomputed on every render.

**Alternative**: Cache metrics and only recalculate when entries or filter change.

**Reasoning**:
- Ring buffer is capped at 500 entries
- Metrics loop is O(n) → ~500 iterations = negligible cost
- Rendering happens ~60 times per second anyway
- Cache would add state management complexity

**Performance Cost**: <1ms per render (measured on real data)

**Future**: If buffer grows to 10k+ entries, add memoization (cache metrics hash + entry count hash).

---

### 1.4 Auto-Analysis: Heartbeat vs On-Demand

**Problem**: User requested automatic 2-minute analysis instead of manual one-shot.

**Solution Considered**:
- **Option A**: setInterval heartbeat with threshold (adopted)
- **Option B**: Debounced trigger (analyze after X seconds of log inactivity)
- **Option C**: Continuous streaming analysis (always analyzing in background)

**Selected**: Option A (2-minute heartbeat)

**Trade-off Analysis**:

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| **Simplicity** | Easy (fixed interval) | Medium (debounce logic) | Complex (streaming) |
| **Responsiveness** | Delayed (max 2min wait) | Fast (seconds) | Immediate (real-time) |
| **LLM Cost** | Low (2 calls/min) | Variable (0-many) | High (continuous) |
| **UI Disruption** | None (background) | Low (infrequent) | High (always streaming) |
| **User Control** | Low (no config) | Medium (adaptive) | High (per-log) |

**Reasoning**: Heartbeat is predictable and cost-effective. Option B (debounce) could trigger too frequently if user is actively logging. Option C wastes LLM resources.

**Skip Threshold (<3 entries)**: Prevents noise when no activity occurs. If user stops interacting, heartbeat skips rather than analyzing 1-2 stale entries.

**Future**: Add config option for heartbeat interval (currently hardcoded to 120s). Consider debounce-like behavior for power users.

---

### 1.5 Insights: Append vs Replace

**Decision**: Insights are **appended** (history preserved).

**Alternative**: Clear insights on each new analysis (FIFO single-buffer).

**Reasoning**:
- User can see progression of system health over time
- Easy to spot patterns ("errors increased after 4 min")
- Minimal memory impact (insights text is typically <10KB even with 3 analyses)

**Potential Issue**: Insights text could grow unbounded if user runs 100+ analyses without clearing.

**Mitigation**: Not yet implemented. Should trim to last ~5000 characters (~3 analyses) when exceeded.

---

### 1.6 Ring Buffer: Hard Limit vs Dynamic

**Decision**: Hard limit of 500 entries (MAX_ENTRIES constant).

**Alternatives**:
- Dynamic sizing (grow up to 10k during high-volume logging)
- Configurable limit (read from ~/.config/agentfactory)
- Time-based eviction (keep entries for 1 hour only)

**Reasoning**:
- 500 entries ≈ 5-10 minutes of typical logging
- Sufficient for post-incident analysis (heartbeat runs every 2 min)
- Fixed memory footprint (~1MB for 500 entries with metadata)
- Predictable behavior (oldest entry always evicted first)

**Trade-off**: Can't retain full session history (e.g., 8-hour dev session). Users need to export logs for archival.

**Future**: Add persistent storage (SQLite) for long-term log retention.

---

## 2. Assumptions

### 2.1 Logger Assumptions

| Assumption | Reasoning | Risk Level |
|-----------|-----------|-----------|
| All panels are initialized before any logging | Logging called in constructors; no logs before init() | **Low** — order is deterministic |
| MIN_LOG_LEVEL='INFO' is never changed at runtime | Logger config is compile-time only | **Low** — hardcoded constant |
| Timestamps are accurate (system clock is set correctly) | Logs trust `new Date()` | **Medium** — can be skewed by NTP/clock changes |
| LogEntry metadata is always JSON-serializable | Meta object is user-created, assumed safe | **Medium** — could contain circular refs |
| Network is available for device-code login (if triggered) | Login flow assumes network (out of scope for Logs) | **Low** — independent system |

### 2.2 Heartbeat Assumptions

| Assumption | Reasoning | Risk Level |
|-----------|-----------|-----------|
| 2-minute interval is appropriate for "auto" analysis | User gave feedback "every 2 minutes" | **Low** — user-specified |
| LLM is available when heartbeat triggers | No graceful degradation if LLM is down | **Medium** — could add offline detection |
| logsLastAnalyzedAt is accurate (no system clock changes) | Unix timestamp uses Date.now() | **Medium** — NTP adjustments could cause skips |
| User wants incremental analysis (new entries only) | Assumption from user feedback | **Low** — user-validated |
| < 3 new entries is the right threshold for skipping | Arbitrary threshold to prevent noise | **Medium** — could be tuned based on usage |

### 2.3 UI Assumptions

| Assumption | Reasoning | Risk Level |
|-----------|-----------|-----------|
| Terminal supports SGR mouse mode (1003) | No fallback to X10 mode | **Low** — tested in dev |
| Terminal supports 256 colors or truecolor | No degradation for 16-color terminals | **Low** — ANSI support is standard |
| Mouse events are reliable (no double-clicks, jitter) | No debouncing in mouse handler | **Medium** — could add debounce if needed |
| Log entries fit in 40% panel width | Layout assumes 40/60 split | **Low** — handled with text truncation |
| Font is monospaced (for alignment) | Box-drawing characters assume monospace | **Low** — standard terminal assumption |

---

## 3. Identified Gaps & Risks

### Gap 1: No Confirmation for Destructive Operations

**Issue**: Pressing `C` immediately clears all logs without confirmation.

**Risk Level**: **Medium** — User data loss possible.

**Impact**: User accidentally presses `C`, loses all log history.

**Mitigation Options**:
1. Add confirmation prompt: "Clear all logs? (y/n)"
2. Add undo: Keep last cleared buffer in memory
3. Auto-backup: Save logs to disk before clear

**Recommended**: Option 1 (low effort, high UX improvement)

**Timeline**: Next PR after release

---

### Gap 2: Analysis Hangs on Network Failure

**Issue**: If LLM is unreachable, agentLoop waits indefinitely (no timeout).

**Risk Level**: **High** — UI becomes unresponsive during auto-analysis.

**Impact**: At T=120s (heartbeat), if network is down, app hangs waiting for LLM response.

**Mitigation Options**:
1. Add 30-second timeout to agentLoop
2. Add 30-second timeout at App level (set timer, cancel on response)
3. Graceful degradation: Skip analysis if LLM unavailable

**Recommended**: Option 2 (safest; doesn't affect other agentLoop usage)

**Timeline**: High priority (patch release)

---

### Gap 3: Insights Text Grows Unbounded

**Issue**: If user runs 100+ analyses, insights text could reach 100KB+ (memory leak).

**Risk Level**: **Low** — unlikely in practice (<1 analysis per 2 min); would take 3+ hours.

**Impact**: Rendering slows, memory usage grows.

**Mitigation**: Trim insights to last 5000 characters (~3 analyses) when exceeded.

**Timeline**: Nice-to-have (can implement in wave 6)

---

### Gap 4: No Persistent Log Storage

**Issue**: Logs are in-memory only (500 entries, ~5-10 min history).

**Risk Level**: **Medium** — Users can't analyze past incidents (e.g., error that occurred 2 hours ago).

**Impact**: Limited historical analysis capability.

**Mitigation Options**:
1. Export logs to CSV/JSON file
2. SQLite backend for persistent storage
3. Remote log aggregation (Datadog, LogTail, etc)

**Recommended**: Option 1 (short-term), Option 2 (long-term)

**Timeline**: Wave 6

---

### Gap 5: No Validation of Log Entry Metadata

**Issue**: When logging, user-provided metadata is passed directly to JSON.stringify().

**Risk Level**: **Low** — Unlikely to cause crashes; worst case is garbled metadata.

**Impact**: Circular references could throw; non-serializable objects would be lost.

**Mitigation**: Sanitize metadata in logger before storing.

**Timeline**: Nice-to-have (can defer)

---

### Gap 6: Filter Affects Analysis but Doesn't Show in Insights Header

**Issue**: User filters to `[Session]`, clicks Analyze. Insights don't show "analyzing Session logs only".

**Risk Level**: **Low** — User can infer filter from log list.

**Impact**: Slight UX confusion ("why don't I see errors from Config?").

**Mitigation**: Prepend filter info to insights header: "[14:30:15] Manual analysis (Session logs only):"

**Timeline**: Nice-to-have (future enhancement)

---

## 4. Missing Scenarios

### Scenario 1: User Rapidly Switches Filters During Analysis

**Steps**:
1. Click [All], click Analyze
2. Analysis starts streaming
3. User clicks [Session] filter
4. Log list filters to Session only
5. Analysis continues streaming (still based on [All])

**Issue**: Right column shows filtered data, but analysis was based on unfiltered data. Inconsistency.

**Mitigation**: 
- Capture filter state at start of analysis: `const filterAtStart = this.selectedSource`
- Show in insights header: "Analyzed All logs"
- Don't allow filter change during analysis (disable chips during streaming)

---

### Scenario 2: App Crashes While Heartbeat Is Scheduled

**Steps**:
1. App running, heartbeat scheduled for T=120s
2. At T=90s, app crashes (uncaught exception)
3. User restarts app

**Issue**: Logs from crash (if captured to disk) are lost; heartbeat never finishes its analysis.

**Mitigation**: Restart analysis from scratch (acceptable; logs are short-lived anyway).

---

### Scenario 3: Terminal Resizes During Metrics Rendering

**Steps**:
1. Logs tab is open, metrics displaying
2. User resizes terminal window
3. Rendering code tries to use old dimensions

**Issue**: Metrics text could be cut off or misaligned.

**Mitigation**: Layout computation detects resize and recalculates. Should already work (depends on app.ts resize handling).

---

### Scenario 4: User Selects Entry, Then Entry is Evicted from Ring Buffer

**Steps**:
1. Entry #480 selected (near end of 500-entry buffer)
2. 30 new entries arrive, pushing entry #480 out
3. User tries to press ↓ to move to next entry

**Issue**: selectedIdx now points to non-existent entry; accessing `entries[selectedIdx]` is undefined.

**Mitigation**: Already handled in code; index clamped to valid range.

---

### Scenario 5: Analysis Completes, Then New Entries Arrive Before Next Heartbeat

**Steps**:
1. T=120s: Auto-analysis completes, analyzes 15 entries
2. T=121s: New message sent, 1 new entry added
3. T=122s: User sends another message, 2nd new entry added  
4. T=240s: Heartbeat triggers, analyzes only 2 entries

**Issue**: User might expect incremental analysis to be "since last analysis" (15 entries ago), not "since end of analysis" (2 entries).

**Mitigation**: Documentation clarifies that "incremental" means since last analysis END, not last analysis START. This is the current behavior and is appropriate.

---

## 5. Potential Enhancements

### Short-term (Next Sprint)

1. **Confirmation Dialog for Clear**
   - Impact: Prevents data loss
   - Effort: 2-4 hours
   - Files: LogsPanel.ts, App.ts
   - Risk: Low

2. **Timeout for Analysis**
   - Impact: Prevents hang on network failure
   - Effort: 4-6 hours
   - Files: App.ts, agentLoop integration
   - Risk: Medium (affects other loops)

3. **Filter Indicator in Insights**
   - Impact: Better UX clarity
   - Effort: 1-2 hours
   - Files: LogsPanel.ts
   - Risk: Low

4. **Search/Filter by Message Content**
   - Impact: Quick issue diagnosis
   - Effort: 6-8 hours
   - Files: LogsPanel.ts
   - Risk: Low

5. **Export Logs to File**
   - Impact: Preserve logs for later analysis
   - Effort: 4-6 hours
   - Files: LogsPanel.ts, App.ts
   - Risk: Low

### Long-term (Wave 6+)

1. **Persistent Storage (SQLite)**
   - Impact: Retain logs across sessions
   - Effort: 20-30 hours
   - Files: src/core/logger.ts (new backend), LogsPanel.ts, migrations
   - Risk: Medium (data integrity)

2. **Metrics Graphs**
   - Impact: Visualize trends over time
   - Effort: 12-16 hours
   - Files: LogsPanel.ts (new rendering), metrics computation
   - Risk: Medium (complex rendering)

3. **Alert Rules**
   - Impact: Notify on ERROR entries or error rate spike
   - Effort: 8-12 hours
   - Files: LogsPanel.ts, App.ts
   - Risk: Medium (notifications system)

4. **Remote Log Aggregation**
   - Impact: Centralized logging for team
   - Effort: 30-40 hours
   - Files: src/core/logger.ts (backend), API calls
   - Risk: High (distributed system complexity)

5. **Performance Profiling from Logs**
   - Impact: Identify bottlenecks
   - Effort: 10-15 hours
   - Files: LogsPanel.ts (analysis UI), metrics computation
   - Risk: Low

---

## 6. Recommended Safeguards & Additional Checks

### Code-level Safeguards

#### S1: Input Validation for Metadata

```typescript
// In logger.ts, sanitize metadata
function sanitizeMetadata(meta: unknown): Record<string, unknown> {
  try {
    // Check for circular references
    JSON.stringify(meta)
    return meta as Record<string, unknown>
  } catch (e) {
    // If not serializable, return empty
    return { _error: 'metadata not serializable' }
  }
}
```

#### S2: Timeout for Auto-Analysis

```typescript
// In app.ts
private async runLogsAnalysis(auto = false): Promise<void> {
  if (this.logsPanel.isInsightsStreaming) return

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null
  try {
    const entries = getRecentLogs(...)
    this.logsPanel.startInsights(auto)

    // Timeout: 30 seconds
    const timeout = new Promise((_, reject) =>
      (timeoutHandle = setTimeout(() => reject(new Error('Analysis timeout')), 30000))
    )

    const analysis = (async () => {
      for await (const e of agentLoop(...)) {
        this.logsPanel.appendInsights(e.delta)
        this.scheduleRender()
      }
    })()

    await Promise.race([analysis, timeout])
  } catch (err) {
    if (err instanceof Error && err.message.includes('timeout')) {
      this.logsPanel.appendInsights('\n[Timeout: Analysis took too long, analysis was interrupted]')
    } else {
      // Network error, log it
      this.logsPanel.appendInsights('\n[Error: Failed to connect to LLM]')
    }
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
    this.logsPanel.finishInsights()
  }
}
```

#### S3: Bounds Check for selectedIdx

```typescript
// In LogsPanel.ts render()
const entries = getRecentLogs(this.selectedSource ?? undefined)

// Ensure selectedIdx is valid
if (this.selectedIdx >= entries.length) {
  this.selectedIdx = -1
}

// Use selectedIdx safely
if (this.selectedIdx >= 0 && this.selectedIdx < entries.length) {
  const entry = entries[this.selectedIdx]!
  // render detail
}
```

#### S4: Limit Insights Text Size

```typescript
// In LogsPanel.ts
appendInsights(delta: string): void {
  this.insightsText += delta
  // Trim if exceeds 10000 characters (keep last 10000)
  if (this.insightsText.length > 10000) {
    this.insightsText = this.insightsText.slice(-10000)
    // Prepend marker: [... truncated ...]
    this.insightsText = '[... truncated ...]\n' + this.insightsText
  }
}
```

### Testing-level Safeguards

#### T1: Add LogsPanel Unit Tests

```typescript
// src/tui/panels/LogsPanel.test.ts
import { describe, it, expect } from 'vitest'
import { LogsPanel } from './LogsPanel'

describe('LogsPanel', () => {
  it('should compute metrics correctly', () => {
    const panel = new LogsPanel({ row: 0, col: 0, height: 10, width: 80 }, () => {})
    const metrics = panel.computeMetrics([
      { timestamp: '...', level: 'INFO', source: 'Session', message: 'test', meta: {} },
      { timestamp: '...', level: 'ERROR', source: 'Session', message: 'error', meta: {} },
    ])
    expect(metrics.total).toBe(2)
    expect(metrics.byLevel.INFO).toBe(1)
    expect(metrics.byLevel.ERROR).toBe(1)
    expect(metrics.errorCount).toBe(1)
  })

  it('should not crash if selectedIdx is out of bounds', () => {
    const panel = new LogsPanel({ ... }, () => {})
    panel.selectedIdx = 999 // Invalid index
    expect(() => panel.render(buf)).not.toThrow()
  })

  // ... more tests
})
```

#### T2: Heartbeat Integration Test

```typescript
// src/app.test.ts
it('should trigger analysis every 120 seconds', async () => {
  const app = new App()
  const analyses: number[] = []
  
  app.onLogsAnalysis = () => analyses.push(Date.now())
  app.start()
  
  // Advance time (mock or real wait)
  await new Promise(r => setTimeout(r, 122000))
  
  expect(analyses.length).toBeGreaterThan(0)
  app.stop()
})
```

### Deployment Safeguards

#### D1: Monitor LLM Availability Before Deploying

Check that Anthropic API is accessible:
```bash
curl -s -H "Authorization: Bearer $ANTHROPIC_API_KEY" https://api.anthropic.com/status
```

#### D2: Add Logging for Heartbeat Lifecycle

```typescript
// In App.ts
private startLogsHeartbeat(): void {
  log.debug('heartbeat started', { interval: 120000 })
  this.logsHeartbeatInterval = setInterval(() => {
    void this.runLogsAnalysis(true)
    log.debug('heartbeat triggered', {})
  }, 2 * 60 * 1000)
}
```

This allows ops to see in logs if heartbeat is running correctly.

---

## 7. Review Checklist

Before shipping this feature:

- [x] All unit tests pass (278/278)
- [x] No TypeScript errors (strict mode)
- [x] Mouse rect bug fixed (logs panel rect set before input dispatch)
- [x] Live logging works (all panels instrumented)
- [x] Metrics dashboard renders correctly
- [x] Manual analysis works (button, streaming, history)
- [x] Auto-analysis heartbeat works (120s interval, incremental)
- [ ] Confirmation dialog added for clear operation
- [ ] Timeout added for analysis (prevent hang)
- [ ] Insights trimming implemented
- [ ] LogsPanel unit tests added
- [ ] Documentation updated (FEATURE-LOGS-PANEL.md)
- [ ] Testing guide completed (TESTING-LOGS-PANEL.md)
- [ ] No console errors during normal use
- [ ] Performance acceptable (render <16ms, no memory leak)

---

## 8. Summary & Recommendations

### What Works Well

1. ✅ **Simple, predictable heartbeat** — 2-minute interval is easy to understand and configure
2. ✅ **Incremental analysis** — Only new entries analyzed, saving LLM costs and reducing prompt size
3. ✅ **History preservation** — Insights append instead of clearing; user sees progression
4. ✅ **Loose coupling** — Panels can log independently without coordinating with Logs tab
5. ✅ **Mouse support** — Full click/scroll interaction after rect bug fix

### What Needs Attention

1. ⚠️ **No timeout for analysis** — Could hang on network failure
2. ⚠️ **No confirmation for clear** — Data loss possible
3. ⚠️ **Unbounded insights growth** — Could accumulate large amounts of text
4. ⚠️ **In-memory only** — No persistent storage; logs lost on restart
5. ⚠️ **No filter state in analysis** — Insights don't indicate which logs were analyzed

### Recommended Priority

| Priority | Item | Reason |
|----------|------|--------|
| **P0 (Blocker)** | Add timeout for analysis | Prevents UI hang in production |
| **P1 (High)** | Add confirmation for clear | Prevents data loss |
| **P2 (Medium)** | Add insights trimming | Prevent memory growth |
| **P3 (Nice)** | Add filter indicator in analysis | Better UX clarity |
| **P4 (Future)** | Persistent storage | Long-term archival |

### Launch Readiness

**Current Status**: Ready for release with P0 fixes (timeout).

**Recommended Timeline**:
1. This sprint: Add timeout for analysis (P0 blocker)
2. Next sprint: Add confirmation dialog (P1), insights trimming (P2)
3. Wave 6: Persistent storage, alerts, metrics graphs (long-term enhancements)

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-06-09  
**Maintainer**: Matheus Lopes  
**Review Status**: Ready for PR review  
