import { describe, it, expect, vi, beforeEach } from 'vitest'
import { agentLoop, type AgentEvent } from './agent-loop.js'
import { Session } from './session.js'

// Mock the Anthropic SDK before any imports resolve it
vi.mock('@anthropic-ai/sdk', () => {
  const makeStream = (events: unknown[]) => ({
    [Symbol.asyncIterator]: async function* () { yield* events },
  })

  const textStream = makeStream([
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ', world!' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: {} },
    { type: 'message_stop' },
  ])

  const mockCreate = vi.fn().mockResolvedValue(textStream)

  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
    },
    _mockCreate: mockCreate,
  }
})

async function collectEvents(session: Session): Promise<AgentEvent[]> {
  const events: AgentEvent[] = []
  for await (const e of agentLoop(session, { maxTurns: 1 })) {
    events.push(e)
  }
  return events
}

describe('agentLoop', () => {
  let session: Session

  beforeEach(() => {
    session = new Session()
    session.addMessage({ role: 'user', content: 'Say hello' })
    vi.clearAllMocks()
  })

  it('yields text_delta events for streamed text', async () => {
    const events = await collectEvents(session)
    const textDeltas = events.filter(e => e.type === 'text_delta')
    expect(textDeltas).toHaveLength(2)
    if (textDeltas[0]?.type === 'text_delta') expect(textDeltas[0].delta).toBe('Hello')
    if (textDeltas[1]?.type === 'text_delta') expect(textDeltas[1].delta).toBe(', world!')
  })

  it('yields turn_end with end_turn stop reason', async () => {
    const events = await collectEvents(session)
    const turnEnd = events.find(e => e.type === 'turn_end')
    expect(turnEnd).toBeDefined()
    if (turnEnd?.type === 'turn_end') expect(turnEnd.stop_reason).toBe('end_turn')
  })

  it('adds assistant message to session history', async () => {
    await collectEvents(session)
    const history = session.getHistory()
    const assistantMsg = history.find(m => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
  })

  it('stops immediately when AbortSignal is pre-aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const events: AgentEvent[] = []
    for await (const e of agentLoop(session, { signal: controller.signal })) {
      events.push(e)
    }
    expect(events).toHaveLength(0)
  })
})
