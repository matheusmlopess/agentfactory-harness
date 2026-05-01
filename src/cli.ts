import { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runDoctor, printDoctorReport } from './harness/doctor.js'
import { PlanSchema } from './orchestration/schema.js'
import { Executor } from './orchestration/executor.js'
import { Planner } from './orchestration/planner.js'
import { AgentTool } from './core/tools/agent.js'
import { Session } from './core/session.js'
import { agentLoop } from './core/agent-loop.js'
import { createAdapter, defaultProvider } from './core/llm/index.js'

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
    .command('run [plan-path]')
    .description('Execute an af-plan.json and stream step events')
    .action(async (planPath: string | undefined) => {
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

      for await (const event of executor.run()) {
        if (event.type === 'plan:done') {
          process.stderr.write('plan:done\n')
        } else {
          process.stderr.write(
            `${event.type.padEnd(14)} ${event.stepId}${event.error ? ` — ${event.error}` : ''}\n`,
          )
        }
      }
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
      const { toposort } = await import('./orchestration/graph.js')
      toposort(result.data.steps)
      process.stdout.write(`Plan "${result.data.name}" is valid (${result.data.steps.length} steps)\n`)
    })

  // Register AgentTool so it's available in agent loops started from CLI
  void AgentTool

  return program
}
