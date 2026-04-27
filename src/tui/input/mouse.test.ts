import { describe, it, expect } from 'vitest'
import { parseMouse } from './mouse.js'

function buf(str: string): Buffer { return Buffer.from(str, 'binary') }

describe('parseMouse', () => {
  it('parses a left-button press', () => {
    // \033[<0;10;5M  — left press at col=10 row=5 (1-based) → col=9 row=4 (0-based)
    const result = parseMouse(buf('\x1b[<0;10;5M'))
    expect(result).not.toBeNull()
    expect(result?.button).toBe('left')
    expect(result?.action).toBe('press')
    expect(result?.col).toBe(9)
    expect(result?.row).toBe(4)
  })

  it('parses a left-button release', () => {
    const result = parseMouse(buf('\x1b[<0;1;1m'))
    expect(result?.action).toBe('release')
    expect(result?.button).toBe('left')
  })

  it('parses a right-button press', () => {
    const result = parseMouse(buf('\x1b[<2;5;3M'))
    expect(result?.button).toBe('right')
    expect(result?.action).toBe('press')
  })

  it('parses a middle-button press', () => {
    const result = parseMouse(buf('\x1b[<1;5;3M'))
    expect(result?.button).toBe('middle')
  })

  it('parses scroll up', () => {
    // button=64 → scroll up
    const result = parseMouse(buf('\x1b[<64;5;3M'))
    expect(result?.button).toBe('scroll_up')
  })

  it('parses scroll down', () => {
    // button=65 → scroll down
    const result = parseMouse(buf('\x1b[<65;5;3M'))
    expect(result?.button).toBe('scroll_down')
  })

  it('parses motion event', () => {
    // button=32 → motion (bit 5 set)
    const result = parseMouse(buf('\x1b[<32;5;3M'))
    expect(result?.action).toBe('move')
    expect(result?.button).toBe('motion')
  })

  it('parses ctrl modifier', () => {
    // button=16 → ctrl bit set
    const result = parseMouse(buf('\x1b[<16;5;3M'))
    expect(result?.ctrl).toBe(true)
    expect(result?.shift).toBe(false)
  })

  it('parses shift+alt modifiers', () => {
    // button=4+8=12 → shift + alt
    const result = parseMouse(buf('\x1b[<12;5;3M'))
    expect(result?.shift).toBe(true)
    expect(result?.alt).toBe(true)
  })

  it('returns null for keyboard input', () => {
    expect(parseMouse(buf('a'))).toBeNull()
    expect(parseMouse(buf('\x1b[A'))).toBeNull()  // arrow key
  })

  it('converts 1-based to 0-based: col=1 row=1 → col=0 row=0', () => {
    const result = parseMouse(buf('\x1b[<0;1;1M'))
    expect(result?.col).toBe(0)
    expect(result?.row).toBe(0)
  })
})
