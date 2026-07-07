import { describe, it, expect, vi } from 'vitest'
import { Keymap } from './keymap.js'
import type { KeyEvent } from './keyboard.js'

const key = (k: string): KeyEvent => ({ key: k, raw: Buffer.from(k) })

describe('Keymap', () => {
  it('runs a matching global binding in any context', () => {
    const run = vi.fn()
    const km = new Keymap()
    km.add([{ id: 'app.quit', keys: ['ctrl+q'], description: 'Quit', run }])
    expect(km.handle(key('ctrl+q'), 'logs', false)).toBe(true)
    expect(run).toHaveBeenCalledOnce()
  })

  it('filters tab-scoped bindings by context', () => {
    const run = vi.fn()
    const km = new Keymap()
    km.add([{ id: 'logs.clear', keys: ['c'], when: 'logs', description: 'Clear', run }])
    expect(km.handle(key('c'), 'session', false)).toBe(false)
    expect(km.handle(key('c'), 'logs', false)).toBe(true)
    expect(run).toHaveBeenCalledOnce()
  })

  it('suppresses printable-char bindings while a text input is active', () => {
    const run = vi.fn()
    const km = new Keymap()
    km.add([{ id: 'help.show', keys: ['?'], description: 'Help', run }])
    expect(km.handle(key('?'), 'session', true)).toBe(false)
    expect(km.handle(key('?'), 'logs', false)).toBe(true)
  })

  it('chord bindings still work while a text input is active', () => {
    const run = vi.fn()
    const km = new Keymap()
    km.add([{ id: 'app.quit', keys: ['ctrl+q'], description: 'Quit', run }])
    expect(km.handle(key('ctrl+q'), 'session', true)).toBe(true)
  })

  it('multiple keys map to one binding (vim aliases)', () => {
    const run = vi.fn()
    const km = new Keymap()
    km.add([{ id: 'logs.next', keys: ['j', 'arrow_down'], when: 'logs', description: 'Next', run }])
    km.handle(key('j'), 'logs', false)
    km.handle(key('arrow_down'), 'logs', false)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('match() exposes panelFirst without running', () => {
    const run = vi.fn()
    const km = new Keymap()
    km.add([{ id: 'plan.run', keys: ['ctrl+r'], description: 'Run', panelFirst: true, run }])
    const def = km.match(key('ctrl+r'), 'session', false)
    expect(def?.panelFirst).toBe(true)
    expect(run).not.toHaveBeenCalled()
  })

  it('rejects duplicate ids', () => {
    const km = new Keymap()
    km.add([{ id: 'x', keys: ['a'], description: 'x', run: () => {} }])
    expect(() => km.add([{ id: 'x', keys: ['b'], description: 'x2', run: () => {} }])).toThrow(/Duplicate/)
  })

  it('list() returns global + context bindings for the help overlay', () => {
    const km = new Keymap()
    km.add([
      { id: 'g', keys: ['ctrl+q'], description: 'g', run: () => {} },
      { id: 'l', keys: ['c'], when: 'logs', description: 'l', run: () => {} },
      { id: 's', keys: ['x'], when: 'session', description: 's', run: () => {} },
    ])
    expect(km.list('logs').map(d => d.id)).toEqual(['g', 'l'])
    expect(km.list().map(d => d.id)).toEqual(['g', 'l', 's'])
  })
})
