import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { z } from 'zod'
import type { Tool } from './index.js'

const execAsync = promisify(exec)

const inputSchema = z.object({
  command: z.string(),
  timeout: z.number().int().positive().optional(),
})

type Input = z.infer<typeof inputSchema>

export const BashTool: Tool<Input, string> = {
  name: 'Bash',
  description: 'Run a shell command and return stdout + stderr',
  inputSchema,
  inputSchemaJson: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to run' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default 30000)' },
    },
    required: ['command'],
  },
  concurrent: false,
  async run({ command, timeout = 30_000 }) {
    try {
      const { stdout, stderr } = await execAsync(command, { timeout })
      return stdout + (stderr ? `\nstderr: ${stderr}` : '')
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`
    }
  },
}
