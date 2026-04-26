import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import type { Tool } from './index.js'

const inputSchema = z.object({
  file_path: z.string(),
})

type Input = z.infer<typeof inputSchema>

export const ReadTool: Tool<Input, string> = {
  name: 'Read',
  description: 'Read a file from disk and return its UTF-8 contents',
  inputSchema,
  inputSchemaJson: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute or relative path to the file' },
    },
    required: ['file_path'],
  },
  concurrent: true,
  async run({ file_path }) {
    try {
      return await readFile(file_path, 'utf8')
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`
    }
  },
}
