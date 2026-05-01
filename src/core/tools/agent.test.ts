import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgentTool } from './agent.js'

// Stub agentLoop so no live API calls are made
vi.mock('../agent-loop.js', () => ({
  agentLoop: vi.fn(),
}))

import { agentLoop } from '../agent-loop.js'
import type { AgentEvent } from '../agent-loop.js'

function makeLoop(events: AgentEvent[]): AsyncIterable<AgentEvent> {
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next() {
          if (i < events.length) return { value: events[i++]!, done: false }
          return { value: undefined as unknown as AgentEvent, done: true }
        },
      }
    },
  }
}

describe('AgentTool', () => {
  beforeEach(() => { vi.mocked(agentLoop).mockReset() })

  it('returns trimmed final text from the loop', async () => {
    vi.mocked(agentLoop).mockReturnValue(
      makeLoop([
        { type: 'text_delta', delta: '  hello ' },
        { type: 'turn_end', stop_reason: 'end_turn' },
      ]),
    )

    const result = await AgentTool.run({ prompt: 'hi', model: undefined })
    expect(result).toBe('hello')
  })

  it('concatenates multiple text_delta events', async () => {
    vi.mocked(agentLoop).mockReturnValue(
      makeLoop([
        { type: 'text_delta', delta: 'foo' },
        { type: 'text_delta', delta: 'bar' },
        { type: 'turn_end', stop_reason: 'end_turn' },
      ]),
    )

    const result = await AgentTool.run({ prompt: 'combine', model: undefined })
    expect(result).toBe('foobar')
  })

  it('returns empty string when no text deltas emitted', async () => {
    vi.mocked(agentLoop).mockReturnValue(
      makeLoop([{ type: 'turn_end', stop_reason: 'end_turn' }]),
    )

    const result = await AgentTool.run({ prompt: 'silent', model: undefined })
    expect(result).toBe('')
  })

  it('has correct tool metadata', () => {
    expect(AgentTool.name).toBe('agent')
    expect(AgentTool.concurrent).toBe(true)
    expect(AgentTool.inputSchemaJson.required).toContain('prompt')
  })
})
