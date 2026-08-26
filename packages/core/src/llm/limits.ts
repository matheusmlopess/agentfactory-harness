/**
 * Model-aware output-token ceilings (gap 15). Replaces the flat
 * DEFAULT_MAX_TOKENS = 2048, which truncated tool-heavy agentic turns.
 */
const PREFIX_LIMITS: ReadonlyArray<readonly [string, number]> = [
  ['claude-', 8192],
  ['gpt-4o', 16384],
  ['gpt-5', 16384],
  ['o3', 16384],
]

const FALLBACK_MAX_TOKENS = 4096

/** Max output tokens to request for a given model id. */
export function maxOutputTokens(model: string | undefined): number {
  if (model) {
    for (const [prefix, limit] of PREFIX_LIMITS) {
      if (model.startsWith(prefix)) return limit
    }
  }
  return FALLBACK_MAX_TOKENS
}
