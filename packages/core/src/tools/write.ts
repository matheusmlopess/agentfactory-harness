import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'
import type { Tool } from './index.js'

const inputSchema = z.object({
  file_path: z.string(),
  content: z.string(),
})

type Input = z.infer<typeof inputSchema>

export const WriteTool: Tool<Input, string> = {
  name: 'Write',
  description: 'Write content to a file, creating parent directories if needed',
  inputSchema,
  inputSchemaJson: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to write to' },
      content: { type: 'string', description: 'Content to write' },
    },
    required: ['file_path', 'content'],
  },
  concurrent: false,
  async run({ file_path, content }) {
    try {
      await mkdir(dirname(file_path), { recursive: true })
      await writeFile(file_path, content, 'utf8')
      return `Written: ${file_path}`
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`
    }
  },
}
