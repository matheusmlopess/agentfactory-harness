/**
 * Tests for the raw-byte classification logic used in app.ts's Terminal tab
 * input bypass. Verifies that F1–F5, Ctrl+Q, Shift+PgUp/Dn, and mouse SGR
 * sequences are correctly identified before PTY forwarding.
 */
import { describe, it, expect } from 'vitest'

// Inline the same classification logic that app.ts uses in listenInput()
// so we can test it without spinning up a full App (process.stdin, PTY, etc.).
type TerminalBypassAction =
  | 'quit'
  | 'palette-toggle'
  | 'tab-0' | 'tab-1' | 'tab-2'
  | 'f4-noop'
  | 'config'
  | 'scroll-back' | 'scroll-fwd'
  | 'mouse-intercept'
  | 'passthrough'

function classifyTerminalInput(data: Buffer): TerminalBypassAction {
  if (data[0] === 0x11) return 'quit'
  if (data[0] === 0x10) return 'palette-toggle'
  const s = data.toString('binary')
  if (s === '\x1bOP' || s === '\x1b[11~') return 'tab-0'   // F1
  if (s === '\x1bOQ' || s === '\x1b[12~') return 'tab-1'   // F2
  if (s === '\x1bOR' || s === '\x1b[13~') return 'tab-2'   // F3
  if (s === '\x1bOS' || s === '\x1b[14~') return 'f4-noop' // F4 — already on Terminal
  if (s === '\x1b[15~')                   return 'config'  // F5 → Config
  if (s === '\x1b[5;2~')                  return 'scroll-back'
  if (s === '\x1b[6;2~')                  return 'scroll-fwd'
  if (s.startsWith('\x1b[<'))             return 'mouse-intercept'
  return 'passthrough'
}

describe('Terminal tab input bypass — raw byte classification', () => {
  it('Ctrl+Q triggers quit', () => {
    expect(classifyTerminalInput(Buffer.from([0x11]))).toBe('quit')
  })

  it('Ctrl+P toggles the command palette (checked before F-keys)', () => {
    expect(classifyTerminalInput(Buffer.from([0x10]))).toBe('palette-toggle')
  })

  it('F1 xterm form (\\x1bOP) → tab-0', () => {
    expect(classifyTerminalInput(Buffer.from('\x1bOP', 'binary'))).toBe('tab-0')
  })

  it('F1 VT100 form (\\x1b[11~) → tab-0', () => {
    expect(classifyTerminalInput(Buffer.from('\x1b[11~', 'binary'))).toBe('tab-0')
  })

  it('F2 xterm form → tab-1', () => {
    expect(classifyTerminalInput(Buffer.from('\x1bOQ', 'binary'))).toBe('tab-1')
  })

  it('F2 VT100 form → tab-1', () => {
    expect(classifyTerminalInput(Buffer.from('\x1b[12~', 'binary'))).toBe('tab-1')
  })

  it('F3 xterm form → tab-2', () => {
    expect(classifyTerminalInput(Buffer.from('\x1bOR', 'binary'))).toBe('tab-2')
  })

  it('F3 VT100 form → tab-2', () => {
    expect(classifyTerminalInput(Buffer.from('\x1b[13~', 'binary'))).toBe('tab-2')
  })

  it('F4 xterm form → f4-noop (already on Terminal)', () => {
    expect(classifyTerminalInput(Buffer.from('\x1bOS', 'binary'))).toBe('f4-noop')
  })

  it('F4 VT100 form → f4-noop', () => {
    expect(classifyTerminalInput(Buffer.from('\x1b[14~', 'binary'))).toBe('f4-noop')
  })

  it('F5 VT100 form (\\x1b[15~) → config', () => {
    expect(classifyTerminalInput(Buffer.from('\x1b[15~', 'binary'))).toBe('config')
  })

  it('Shift+PgUp → scroll-back', () => {
    expect(classifyTerminalInput(Buffer.from('\x1b[5;2~', 'binary'))).toBe('scroll-back')
  })

  it('Shift+PgDn → scroll-fwd', () => {
    expect(classifyTerminalInput(Buffer.from('\x1b[6;2~', 'binary'))).toBe('scroll-fwd')
  })

  it('SGR mouse event → mouse-intercept', () => {
    expect(classifyTerminalInput(Buffer.from('\x1b[<0;5;10M', 'binary'))).toBe('mouse-intercept')
  })

  it('Tab character (0x09) → passthrough to PTY', () => {
    expect(classifyTerminalInput(Buffer.from([0x09]))).toBe('passthrough')
  })

  it('regular printable char → passthrough to PTY', () => {
    expect(classifyTerminalInput(Buffer.from('a'))).toBe('passthrough')
  })

  it('Enter (0x0d) → passthrough to PTY', () => {
    expect(classifyTerminalInput(Buffer.from([0x0d]))).toBe('passthrough')
  })
})
