import { describe, it, expect, vi } from 'vitest'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

import { OpenAIAdapter } from './openai-adapter.js'

function makeAsyncIter(chunks: object[]): object {
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next() {
          if (i < chunks.length) return { value: chunks[i++], done: false }
          return { value: undefined, done: true }
        },
      }
    },
  }
}

const msgs: MessageParam[] = [{ role: 'user', content: 'hello' }]
const opts = { model: 'gpt-4o', systemPrompt: 'sys', tools: [] }

describe('OpenAIAdapter.stream', () => {
  it('emits text_delta for content chunks', async () => {
    mockCreate.mockResolvedValue(makeAsyncIter([
      { choices: [{ delta: { content: 'hi' }, finish_reason: null }] },
      { choices: [{ delta: {}, finish_reason: 'stop' }] },
    ]))
    const adapter = new OpenAIAdapter('key')
    const chunks = []
    for await (const c of adapter.stream(msgs, opts)) chunks.push(c)
    expect(chunks).toContainEqual({ type: 'text_delta', text: 'hi' })
    expect(chunks).toContainEqual({ type: 'message_end', stop_reason: 'end_turn' })
  })

  it('emits tool_start + tool_input_delta for tool_calls', async () => {
    mockCreate.mockResolvedValue(makeAsyncIter([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'bash', arguments: '' } }] }, finish_reason: null }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"cmd":"ls"}' } }] }, finish_reason: null }] },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    ]))
    const adapter = new OpenAIAdapter('key')
    const chunks = []
    for await (const c of adapter.stream(msgs, opts)) chunks.push(c)
    expect(chunks).toContainEqual({ type: 'tool_start', id: 'c1', name: 'bash' })
    expect(chunks).toContainEqual({ type: 'tool_input_delta', index: 0, json: '{"cmd":"ls"}' })
    expect(chunks).toContainEqual({ type: 'message_end', stop_reason: 'tool_use' })
  })

  it('maps finish_reason tool_calls → stop_reason tool_use', async () => {
    mockCreate.mockResolvedValue(makeAsyncIter([
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    ]))
    const adapter = new OpenAIAdapter('key')
    const chunks = []
    for await (const c of adapter.stream(msgs, opts)) chunks.push(c)
    expect(chunks).toContainEqual({ type: 'message_end', stop_reason: 'tool_use' })
  })
})
