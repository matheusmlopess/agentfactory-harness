import { z } from 'zod'

export interface InputSchemaJson {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}

export interface Tool<I = unknown, O = unknown> {
  name: string
  description: string
  inputSchema: z.ZodSchema<I>
  inputSchemaJson: InputSchemaJson
  run(input: I): Promise<O>
  concurrent?: boolean
}

const registry = new Map<string, Tool>()

export function registerTool(tool: Tool): void {
  registry.set(tool.name, tool)
}

export function getTool(name: string): Tool | undefined {
  return registry.get(name)
}

export function listTools(): Tool[] {
  return [...registry.values()]
}

export async function dispatch(name: string, rawInput: unknown): Promise<string> {
  const tool = registry.get(name)
  if (!tool) {
    const avail = [...registry.keys()].join(', ')
    return `Error: tool "${name}" is not available. Available tools: ${avail}.`
  }

  const parsed = tool.inputSchema.safeParse(rawInput)
  if (!parsed.success) {
    // Concise, model-friendly summary instead of a raw Zod dump — so any
    // provider's model recovers in one turn rather than looping on the error.
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    const required = tool.inputSchemaJson.required ?? []
    return `Error: invalid input for "${name}". ${issues}. Required fields: ${required.join(', ') || 'none'}.`
  }

  try {
    const result = await tool.run(parsed.data)
    return typeof result === 'string' ? result : JSON.stringify(result)
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`
  }
}
