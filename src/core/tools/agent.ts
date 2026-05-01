import { z } from 'zod'
import { type Tool } from './index.js'
import { Session } from '../session.js'
import { agentLoop } from '../agent-loop.js'

const inputSchema = z.object({
  prompt: z.string().min(1),
  model: z.string().optional(),
})

type AgentInput = z.infer<typeof inputSchema>

export const AgentTool: Tool<AgentInput, string> = {
  name: 'agent',
  description: 'Run a sub-agent with the given prompt and return its final text output',
  inputSchema,
  inputSchemaJson: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'The prompt to send to the sub-agent' },
      model: { type: 'string', description: 'Model override (optional)' },
    },
    required: ['prompt'],
  },
  concurrent: true,

  async run({ prompt, model }): Promise<string> {
    const session = new Session()
    session.addMessage({ role: 'user', content: prompt })

    let output = ''
    const loopOpts = { maxTurns: 10, ...(model !== undefined && { model }) }
    for await (const event of agentLoop(session, loopOpts)) {
      if (event.type === 'text_delta') {
        output += event.delta
      }
    }
    return output.trim()
  },
}
