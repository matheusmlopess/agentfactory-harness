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
  if (!tool) return `Error: tool "${name}" not found`

  const parsed = tool.inputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return `Error: invalid input for "${name}": ${parsed.error.message}`
  }

  try {
    const result = await tool.run(parsed.data)
    return typeof result === 'string' ? result : JSON.stringify(result)
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`
  }
}
