import { describe, it, expect, vi } from 'vitest'
import { NodeInspector } from './NodeInspector.js'
import { CellBuffer } from '@factory/shared/renderer/cell-buffer.js'
import type { StudioNode } from '@factory/orchestration/studio-model.js'

const node = (over: Partial<StudioNode> = {}): StudioNode => ({
  id: 'worker-1', kind: 'agent', row: 0, col: 0, agent: 'worker', prompt: 'Do the thing', ...over,
})

const key = (k: string) => ({ key: k, raw: Buffer.from(k) })

function make(over: Partial<StudioNode> = {}, takenIds: string[] = []) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  const insp = new NodeInspector(node(over), { onSave, onCancel, takenIds })
  return { insp, onSave, onCancel }
}

describe('NodeInspector', () => {
  it('renders all fields + validity line', () => {
    const { insp } = make()
    const buf = new CellBuffer(24, 80)
    insp.render(buf, { row: 1, col: 0, height: 22, width: 80 })
    const plain = buf.diff(new CellBuffer(24, 80)).replace(/\x1b\[[^m]*m|\x1b\[\d+;\d+H/g, '')
    expect(plain).toContain('Edit: worker-1')
    for (const label of ['id', 'agent', 'provider', 'model', 'timeout', 'prompt']) {
      expect(plain).toContain(label)
    }
    expect(plain).toContain('✓ valid')
  })

  it('Enter saves the edited node (typing appends to the focused field)', () => {
    const { insp, onSave } = make()
    insp.onKey(key('x'))          // id field focused → 'worker-1x'
    insp.onKey(key('enter'))
    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0]![0]).toMatchObject({ id: 'worker-1x', agent: 'worker' })
  })

  it('Esc cancels without saving', () => {
    const { insp, onSave, onCancel } = make()
    insp.onKey(key('escape'))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('blocks save on invalid id / duplicate id / empty prompt', () => {
    const dup = make({}, ['taken'])
    // Clear the id and type a duplicate
    for (let i = 0; i < 10; i++) dup.insp.onKey(key('backspace'))
    for (const ch of 'taken') dup.insp.onKey(key(ch))
    expect(dup.insp.issues().some(s => s.includes('already exists'))).toBe(true)
    dup.insp.onKey(key('enter'))
    expect(dup.onSave).not.toHaveBeenCalled()

    const bad = make({ prompt: '' })
    expect(bad.insp.issues().some(s => s.includes('prompt is required'))).toBe(true)
  })

  it('←/→ cycles the provider; Tab moves between fields', () => {
    const { insp, onSave } = make()
    insp.onKey(key('tab'))  // agent
    insp.onKey(key('tab'))  // provider
    insp.onKey(key('arrow_right'))
    insp.onKey(key('enter'))
    expect(onSave.mock.calls[0]![0]).toMatchObject({ provider: 'anthropic' })
  })

  it('timeout must be numeric; saves as a number', () => {
    const { insp, onSave } = make()
    for (let i = 0; i < 4; i++) insp.onKey(key('tab'))  // → timeout
    insp.onKey(key('3'))
    insp.onKey(key('0'))
    insp.onKey(key('enter'))
    expect(onSave.mock.calls[0]![0]).toMatchObject({ timeout: 30 })
  })
})
