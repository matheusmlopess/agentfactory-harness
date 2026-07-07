import { LogsPanel } from './panel.js'
import { Session } from '../../core/session.js'
import { agentLoop } from '../../core/agent-loop.js'
import { createAdapter, defaultProvider } from '../../core/llm/index.js'
import { getRecentLogs, type LogEntry } from '../../core/logger.js'
import { motionEnabled } from '../../shared/renderer/motion.js'
import type { Feature, FeatureCtx } from '../types.js'

/**
 * The Logs tab as a self-contained Feature — the registry's proving case
 * (docs/ddd/11-feature-isolation.md step 2). Owns its panel, the AI
 * log-analysis flow, and the 2-minute heartbeat; the host wires none of it.
 */
export function logsFeature(): Feature {
  let panel: LogsPanel | null = null
  let ctx: FeatureCtx | null = null
  let lastAnalyzedAt = 0
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let countdown: ReturnType<typeof setInterval> | null = null

  async function runAnalysis(auto: boolean): Promise<void> {
    if (!panel || !ctx || panel.isInsightsStreaming) return

    const allEntries = getRecentLogs()
    const since = auto ? lastAnalyzedAt : 0
    const entries = since > 0
      ? allEntries.filter((e: LogEntry) => new Date(e.timestamp).getTime() > since)
      : allEntries

    if (auto && entries.length < 3) return

    const startedAt = Date.now()
    panel.startInsights(auto)
    ctx.scheduleRender()

    const sample = entries.slice(-50)
    const lines = sample
      .map(
        (e: LogEntry) =>
          `[${e.timestamp.slice(11, 19)}] ${e.level.padEnd(5)} ${e.source.padEnd(15)} ${e.message}` +
          (e.meta ? ' ' + JSON.stringify(e.meta) : ''),
      )
      .join('\n')

    const prompt =
      `You are analyzing application logs from agentfactory-harness, an AI agent terminal. ` +
      `Summarize what happened, highlight any warnings or errors, and suggest anything unusual.\n\n` +
      `Log entries (most recent last):\n${lines}`

    const session = new Session()
    session.addMessage({ role: 'user', content: prompt })
    const adapter = createAdapter(defaultProvider())

    try {
      for await (const e of agentLoop(session, { adapter })) {
        if (e.type === 'text_delta') {
          panel.appendInsights(e.delta)
          ctx.scheduleRender()
        }
      }
    } finally {
      lastAnalyzedAt = startedAt
      panel.finishInsights()
      ctx.scheduleRender()
    }
  }

  return {
    id: 'logs',
    tab: {
      id: 'logs',
      title: 'Logs',
      captureMouse: true,
      rectFor: l => l.logs,
      hitVisible: () => false,
      makePanel(c: FeatureCtx) {
        ctx = c
        panel = new LogsPanel(
          c.layout().logs,
          () => c.scheduleRender(),
          () => { void runAnalysis(false) },
        )
        return panel
      },
    },
    keybindings() {
      return [
        { id: 'logs.prev',      keys: ['k'], when: 'logs' as const, description: 'Select previous log entry', run: () => panel?.selectPrev() },
        { id: 'logs.next',      keys: ['j'], when: 'logs' as const, description: 'Select next log entry',     run: () => panel?.selectNext() },
        { id: 'logs.srcPrev',   keys: ['h'], when: 'logs' as const, description: 'Previous source filter',    run: () => panel?.cycleSource(-1) },
        { id: 'logs.srcNext',   keys: ['l'], when: 'logs' as const, description: 'Next source filter',        run: () => panel?.cycleSource(1) },
        { id: 'logs.clear',     keys: ['c'], when: 'logs' as const, description: 'Clear log buffer',          run: () => panel?.clearLogs() },
        { id: 'logs.analyze',   keys: ['a'], when: 'logs' as const, description: 'Analyze logs with AI',      run: () => panel?.analyze() },
      ]
    },
    start(c: FeatureCtx) {
      ctx = c
      // 2-minute analysis heartbeat
      heartbeat = setInterval(() => { void runAnalysis(true) }, 2 * 60 * 1000)
      // 1-second countdown label — skipped entirely under reduced motion
      if (motionEnabled()) {
        let secs = 120
        countdown = setInterval(() => {
          secs = Math.max(0, secs - 1)
          panel?.setCountdown(secs)
          if (secs === 0) secs = 120
          c.scheduleRender()
        }, 1000)
      }
    },
    stop() {
      if (heartbeat) { clearInterval(heartbeat); heartbeat = null }
      if (countdown) { clearInterval(countdown); countdown = null }
    },
  }
}
