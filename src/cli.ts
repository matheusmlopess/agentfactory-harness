import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runDoctor, printDoctorReport } from './harness/doctor.js'
import { PlanSchema } from '@factory/orchestration/schema.js'
import { Executor } from '@factory/orchestration/executor.js'
import { Planner } from '@factory/orchestration/planner.js'
import { registerTool } from '@factory/core/tools/index.js'
import { AgentTool } from '@factory/core/tools/agent.js'
import { Session } from '@factory/core/session.js'
import { agentLoop } from '@factory/core/agent-loop.js'
import { createAdapter, defaultProvider } from '@factory/core/llm/index.js'
import { store } from '@factory/core/config/store.js'
import {
  CONTRACT_VERSION, isContractCompatible, isFeatureEnabled, type Feature,
} from '@factory/contracts/index.js'
import { sessionFeature } from './features/session/index.js'
import { canvasFeature } from './features/canvas/index.js'
import { agentsFeature } from './features/agents/index.js'
import { terminalFeature } from './features/terminal/index.js'
import { configFeature } from './features/config/index.js'
import { logsFeature } from './features/logs/index.js'

export function buildCli(version: string): Command {
  const program = new Command()

  program
    .name('factory')
    .description('AgentFactory Harness — ITUI orchestration shell for AI agents')
    .version(version, '-v, --version')

  program
    .command('doctor')
    .description('Check environment health (API key, harness, Node version)')
    .action(() => {
      const results = runDoctor(process.cwd())
      printDoctorReport(results)
    })

  program
    .command('features')
    .description('List features with their enabled/compatibility state (Stage E)')
    .action(async () => {
      await store.init()
      const features: Feature[] = [
        sessionFeature(), canvasFeature(), agentsFeature(),
        terminalFeature(), configFeature(), logsFeature(),
      ]
      process.stdout.write(`Contract version: ${CONTRACT_VERSION}\n\n`)
      process.stdout.write(`  state      id             contract  provides / consumes\n`)
      for (const f of features) {
        const m = f.manifest
        if (!m) continue
        const compatible = isContractCompatible(m.contract)
        const enabled = isFeatureEnabled(m, (k) => store.getSetting(k))
        const state = !compatible ? 'incompat' : enabled ? 'on' : 'off'
        const io = [
          (m.provides ?? []).map(p => `+${p}`).join(' '),
          (m.consumes ?? []).map(c => `-${c}`).join(' '),
        ].filter(Boolean).join('  ')
        process.stdout.write(
          `  ${state.padEnd(9)} ${m.id.padEnd(14)} ${m.contract.padEnd(9)} ${io}\n`,
        )
      }
    })

  program
    .command('run [plan-path]')
    .description('Execute an af-plan.json and stream step events')
    .option('--json', 'emit newline-delimited JSON events on stdout (for automation)')
    .action(async (planPath: string | undefined, opts: { json?: boolean }) => {
      const file = resolve(process.cwd(), planPath ?? 'af-plan.json')
      const raw = JSON.parse(await readFile(file, 'utf8'))
      const plan = PlanSchema.parse(raw)

      const executor = new Executor(plan, {
        agentRunner: async (step) => {
          const provider = step.provider ?? defaultProvider()
          const adapter = createAdapter(provider)
          const session = new Session()
          session.addMessage({ role: 'user', content: step.prompt })
          let out = ''
          for await (const e of agentLoop(session, {
            adapter,
            ...(step.model !== undefined ? { model: step.model } : {}),
          })) {
            if (e.type === 'text_delta') out += e.delta
          }
          return out.trim()
        },
      })

      let failed = false
      for await (const event of executor.run()) {
        if (event.type === 'step:error') failed = true
        if (opts.json) {
          // NDJSON contract: one JSON object per StepEvent + ISO timestamp
          // on stdout; human-readable lines stay on stderr
          process.stdout.write(JSON.stringify({ ...event, ts: new Date().toISOString() }) + '\n')
          continue
        }
        if (event.type === 'plan:done') {
          process.stderr.write('plan:done\n')
        } else {
          process.stderr.write(
            `${event.type.padEnd(14)} ${event.stepId}${event.error ? ` — ${event.error}` : ''}\n`,
          )
        }
      }
      if (failed) process.exitCode = 1
    })

  const planCmd = program
    .command('plan')
    .description('Plan management commands')

  planCmd
    .command('new')
    .description('Interactive wizard to create af-plan.json')
    .action(async () => {
      const planner = new Planner()
      await planner.wizard(process.cwd())
    })

  planCmd
    .command('validate [plan-path]')
    .description('Validate af-plan.json for schema errors and cycles')
    .action(async (planPath: string | undefined) => {
      const file = resolve(process.cwd(), planPath ?? 'af-plan.json')
      const raw = JSON.parse(await readFile(file, 'utf8'))
      const result = PlanSchema.safeParse(raw)
      if (!result.success) {
        process.stderr.write(`Invalid plan:\n${result.error.message}\n`)
        process.exit(1)
      }
      // toposort throws on cycle
      const { toposort } = await import('@factory/orchestration/graph.js')
      toposort(result.data.steps)
      process.stdout.write(`Plan "${result.data.name}" is valid (${result.data.steps.length} steps)\n`)
    })

  // NOTE: AgentTool is intentionally NOT registered globally. The tool registry
  // is a shared singleton; registering it here leaks the `agent` tool into the
  // interactive Session loop, where the model calls it with input the Zod schema
  // rejects ("invalid input for 'agent'"). The orchestration executor uses its
  // own agentRunner, so it doesn't need the tool registered.
  void AgentTool

  return program
}
