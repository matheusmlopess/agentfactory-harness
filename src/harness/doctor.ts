import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

interface CheckResult {
  label: string
  ok: boolean
  detail: string
}

export function runDoctor(cwd: string): CheckResult[] {
  const results: CheckResult[] = []

  // 1. Node version
  const [major] = process.versions.node.split('.').map(Number)
  results.push({
    label: 'Node.js version',
    ok: (major ?? 0) >= 20,
    detail: `v${process.versions.node} (need ≥ 20)`,
  })

  // 2. LLM provider + API key
  const provider = process.env['LLM_PROVIDER'] ?? 'anthropic'
  results.push({
    label: 'LLM_PROVIDER',
    ok: true,
    detail: provider,
  })

  const anthropicKey = Boolean(process.env['ANTHROPIC_API_KEY'])
  results.push({
    label: 'ANTHROPIC_API_KEY',
    ok: anthropicKey,
    detail: anthropicKey ? 'set' : 'not set — set to use Claude models',
  })

  const openaiKey = Boolean(process.env['OPENAI_API_KEY'])
  results.push({
    label: 'OPENAI_API_KEY',
    ok: openaiKey,
    detail: openaiKey ? 'set' : 'not set — set to use OpenAI models',
  })

  // 3. Auth token file
  const tokenPath = join(homedir(), '.agentfactory', 'token')
  const hasToken = existsSync(tokenPath)
  results.push({
    label: 'Registry token',
    ok: hasToken,
    detail: hasToken ? tokenPath : 'not found — publish/import unavailable',
  })

  // 4. .ai/ harness
  const hasHarness = existsSync(join(cwd, '.ai', 'AgentFactory.md'))
  results.push({
    label: '.ai/ harness',
    ok: hasHarness,
    detail: hasHarness ? join(cwd, '.ai') : 'not found in current directory',
  })

  // 5. CLAUDE.md
  const hasClaude = existsSync(join(cwd, 'CLAUDE.md'))
  results.push({
    label: 'CLAUDE.md',
    ok: hasClaude,
    detail: hasClaude ? 'present' : 'not found',
  })

  return results
}

export function printDoctorReport(results: CheckResult[]): void {
  const green = '\x1b[32m'
  const red   = '\x1b[31m'
  const dim   = '\x1b[2m'
  const reset = '\x1b[0m'
  const bold  = '\x1b[1m'

  console.log(`\n${bold}factory doctor${reset}\n`)

  for (const r of results) {
    const icon  = r.ok ? `${green}✓${reset}` : `${red}✗${reset}`
    const label = r.label.padEnd(24)
    console.log(`  ${icon}  ${label} ${dim}${r.detail}${reset}`)
  }

  const pass = results.filter(r => r.ok).length
  const total = results.length
  console.log(`\n  ${pass}/${total} checks passed\n`)
}
