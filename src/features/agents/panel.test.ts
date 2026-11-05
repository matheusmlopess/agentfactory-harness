import { describe, it, expect } from 'vitest'
import { AgentsPanel } from './panel.js'
import { CellBuffer } from '@factory/shared/renderer/cell-buffer.js'
import { PlanSchema } from '@factory/orchestration/schema.js'

const plan = PlanSchema.parse({
  version: '1.0',
  name: 'demo-team',
  steps: [
    { id: 'plan', agent: 'planner', prompt: 'p' },
    { id: 'build', agent: 'worker', prompt: 'q', dependsOn: ['plan'] },
    { id: 'review', agent: 'reviewer', prompt: 'r', dependsOn: ['build'] },
  ],
})

function makePanel(width = 90): AgentsPanel {
  return new AgentsPanel({ row: 1, col: 0, height: 20, width }, () => {})
}

function plain(panel: AgentsPanel): string {
  const buf = new CellBuffer(24, 120)
  panel.render(buf)
  return buf.diff(new CellBuffer(24, 120)).replace(/\x1b\[[^m]*m|\x1b\[\d+;\d+H/g, '')
}

describe('AgentsPanel — team mode (PLAN-10 standalone)', () => {
  it('setPlan enters team mode with all steps pending (glyph + text label)', () => {
    const p = makePanel()
    p.setPlan(plan)
    expect(p.mode).toBe('team')
    const out = plain(p)
    expect(out).toContain('Team — demo-team')
    expect(out).toContain('[0 running / 3 total]')
    expect(out).toContain('◎ plan [pending]')
    expect(out).toContain('◎ build [pending]')
  })

  it('onPlanEvent updates statuses incl. skipped (kept distinct) + event log', () => {
    const p = makePanel()
    p.setPlan(plan)
    p.onPlanEvent({ type: 'step:start', stepId: 'plan', status: 'running' })
    p.onPlanEvent({ type: 'step:error', stepId: 'plan', status: 'error', error: 'boom' })
    p.onPlanEvent({ type: 'step:skipped', stepId: 'build', status: 'skipped' })
    const out = plain(p)
    expect(out).toContain('✗ plan [error]')
    expect(out).toContain('⊘ build [skipped]')
    expect(out).toContain('step:skipped build')
    expect(out).toContain('boom')
  })

  it('sessions mode is untouched; Esc exits team mode back to sessions', () => {
    const p = makePanel()
    expect(p.mode).toBe('sessions')
    p.setPlan(plan)
    expect(p.onKey({ key: 'escape', raw: Buffer.from('\x1b') })).toBe(true)
    expect(p.mode).toBe('sessions')
    // Sessions render path unchanged
    p.setAgents([{ name: 'Marie Curie', status: 'running', active: true }])
    expect(plain(p)).toContain('Marie Curie')
  })

  it('narrow panel stacks single-column without throwing', () => {
    const p = makePanel(48)
    p.setPlan(plan)
    p.onPlanEvent({ type: 'step:done', stepId: 'plan', status: 'done', durationMs: 3200, output: 'ok' })
    const out = plain(p)
    expect(out).toContain('✓ plan [done] 3.2s')
  })
})
