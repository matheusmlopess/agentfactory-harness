import { z } from 'zod'
import type { Tool } from './index.js'

const inputSchema = z.object({
  url: z.string().url(),
})

type Input = z.infer<typeof inputSchema>

export const WebFetchTool: Tool<Input, string> = {
  name: 'WebFetch',
  description: 'Fetch a URL and return the response body as text',
  inputSchema,
  inputSchemaJson: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
    required: ['url'],
  },
  concurrent: true,
  async run({ url }) {
    try {
      const res = await fetch(url)
      if (!res.ok) return `Error: HTTP ${res.status} ${res.statusText}`
      return await res.text()
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`
    }
  },
}
