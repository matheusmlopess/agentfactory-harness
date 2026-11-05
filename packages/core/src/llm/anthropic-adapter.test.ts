import { describe, it, expect, vi } from 'vitest'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
}))

import { AnthropicAdapter } from './anthropic-adapter.js'

function makeStream(events: object[]): object {
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next() {
          if (i < events.length) return { value: events[i++], done: false }
          return { value: undefined, done: true }
        },
      }
    },
  }
}

const msgs: MessageParam[] = [{ role: 'user', content: 'hi' }]
const opts = { model: 'claude-opus-4-7', systemPrompt: 'sys', tools: [] }

describe('AnthropicAdapter.stream', () => {
  it('emits text_delta chunks', async () => {
    mockCreate.mockResolvedValue(makeStream([
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hello' } },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
    ]))
    const adapter = new AnthropicAdapter('key')
    const chunks = []
    for await (const c of adapter.stream(msgs, opts)) chunks.push(c)
    expect(chunks).toContainEqual({ type: 'text_delta', text: 'hello' })
    expect(chunks).toContainEqual({ type: 'message_end', stop_reason: 'end_turn' })
  })

  it('emits tool_start + tool_input_delta for tool_use block', async () => {
    mockCreate.mockResolvedValue(makeStream([
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'tid', name: 'bash' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"cmd' } },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
    ]))
    const adapter = new AnthropicAdapter('key')
    const chunks = []
    for await (const c of adapter.stream(msgs, opts)) chunks.push(c)
    expect(chunks).toContainEqual({ type: 'tool_start', id: 'tid', name: 'bash' })
    expect(chunks).toContainEqual({ type: 'tool_input_delta', index: 0, json: '{"cmd' })
  })

  it('stop_reason is passed through in message_end', async () => {
    mockCreate.mockResolvedValue(makeStream([
      { type: 'message_delta', delta: { stop_reason: 'max_tokens' } },
    ]))
    const adapter = new AnthropicAdapter('key')
    const chunks = []
    for await (const c of adapter.stream(msgs, opts)) chunks.push(c)
    expect(chunks).toContainEqual({ type: 'message_end', stop_reason: 'max_tokens' })
  })
})
