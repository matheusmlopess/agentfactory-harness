import { describe, it, expect, beforeEach } from 'vitest'
import { Session } from './session.js'

describe('Session', () => {
  let session: Session

  beforeEach(() => {
    session = new Session()
  })

  it('starts with empty history', () => {
    expect(session.getHistory()).toHaveLength(0)
  })

  it('addMessage appends in order', () => {
    session.addMessage({ role: 'user', content: 'hello' })
    session.addMessage({ role: 'assistant', content: 'hi' })
    const h = session.getHistory()
    expect(h).toHaveLength(2)
    expect(h[0]).toMatchObject({ role: 'user', content: 'hello' })
    expect(h[1]).toMatchObject({ role: 'assistant', content: 'hi' })
  })

  it('getHistory returns a readonly view — direct push is not possible via the type', () => {
    session.addMessage({ role: 'user', content: 'a' })
    const h = session.getHistory()
    // readonly array — TypeScript forbids h.push(...) at compile time
    // Runtime: verify the length is still 1 after we do nothing
    expect(h).toHaveLength(1)
  })

  it('tokenCount returns a positive estimate after messages', () => {
    session.addMessage({ role: 'user', content: 'This is a test message with some content.' })
    expect(session.tokenCount()).toBeGreaterThan(0)
  })

  it('tokenCount is 0 on empty history', () => {
    expect(session.tokenCount()).toBe(0)
  })

  it('clear resets history and tokenCount', () => {
    session.addMessage({ role: 'user', content: 'hello' })
    session.clear()
    expect(session.getHistory()).toHaveLength(0)
    expect(session.tokenCount()).toBe(0)
  })
})
