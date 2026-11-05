import { describe, it, expect } from 'vitest'
import { parseKey } from './keyboard.js'

function buf(bytes: number[]): Buffer { return Buffer.from(bytes) }
function str(s: string): Buffer { return Buffer.from(s, 'utf8') }

describe('parseKey — critical control characters', () => {
  it('Enter (\\r) → "enter", not "ctrl+m"', () => {
    expect(parseKey(buf([0x0d]))).toMatchObject({ key: 'enter' })
  })

  it('Enter (\\n) → "enter", not "ctrl+j"', () => {
    expect(parseKey(buf([0x0a]))).toMatchObject({ key: 'enter' })
  })

  it('Enter (\\r\\n Windows Terminal) → "enter"', () => {
    expect(parseKey(str('\r\n'))).toMatchObject({ key: 'enter' })
  })

  it('Tab (\\t) → "tab", not "ctrl+i"', () => {
    expect(parseKey(buf([0x09]))).toMatchObject({ key: 'tab' })
  })

  it('Backspace (\\x7f DEL) → "backspace"', () => {
    expect(parseKey(buf([0x7f]))).toMatchObject({ key: 'backspace' })
  })

  it('Backspace (\\x08 BS) → "backspace", not "ctrl+h"', () => {
    expect(parseKey(buf([0x08]))).toMatchObject({ key: 'backspace' })
  })
})

describe('parseKey — ctrl shortcuts', () => {
  it('ctrl+c (0x03) → "ctrl+c"', () => {
    expect(parseKey(buf([0x03]))).toMatchObject({ key: 'ctrl+c' })
  })

  it('ctrl+q (0x11) → "ctrl+q"', () => {
    expect(parseKey(buf([0x11]))).toMatchObject({ key: 'ctrl+q' })
  })

  it('ctrl+a (0x01) → "ctrl+a"', () => {
    expect(parseKey(buf([0x01]))).toMatchObject({ key: 'ctrl+a' })
  })
})

describe('parseKey — printable characters', () => {
  it('letter a → "a"', () => {
    expect(parseKey(str('a'))).toMatchObject({ key: 'a' })
  })

  it('digit 1 → "1"  (not a tab switch)', () => {
    expect(parseKey(str('1'))).toMatchObject({ key: '1' })
  })

  it('space → " "', () => {
    expect(parseKey(str(' '))).toMatchObject({ key: ' ' })
  })
})

describe('parseKey — escape sequences', () => {
  it('arrow up → "arrow_up"', () => {
    expect(parseKey(str('\x1b[A'))).toMatchObject({ key: 'arrow_up' })
  })

  it('F1 (xterm) → "f1"', () => {
    expect(parseKey(str('\x1bOP'))).toMatchObject({ key: 'f1' })
  })

  it('SGR mouse sequence → null', () => {
    expect(parseKey(str('\x1b[<0;5;10M'))).toBeNull()
  })
})
