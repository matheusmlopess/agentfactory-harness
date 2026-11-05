import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'SessionStart'
  | 'SessionStop'
  | 'StepStart'
  | 'StepComplete'

export interface HookResult {
  continue: boolean
}

export async function runHook(
  event: HookEvent,
  ctx: Record<string, unknown>,
  cwd = process.cwd()
): Promise<HookResult> {
  const hookPath = `${cwd}/.ai/hooks/${event}.sh`
  if (!existsSync(hookPath)) return { continue: true }

  try {
    await execFileAsync(hookPath, [], {
      env: { ...process.env, HOOK_CTX: JSON.stringify(ctx) },
    })
    return { continue: true }
  } catch {
    if (event === 'PreToolUse') return { continue: false }
    return { continue: true }
  }
}
