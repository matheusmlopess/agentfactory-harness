import { createInterface } from 'node:readline'
import { writeFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PlanSchema, type Plan, type Step } from './schema.js'

function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve))
}

export class Planner {
  async wizard(cwd: string = process.cwd()): Promise<Plan> {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      return await this.#run(rl, cwd)
    } finally {
      rl.close()
    }
  }

  async #run(
    rl: ReturnType<typeof createInterface>,
    cwd: string,
  ): Promise<Plan> {
    console.log('\n  factory plan new — interactive wizard\n')

    const name = (await prompt(rl, '  Plan name: ')).trim()
    if (!name) throw new Error('Plan name is required')

    const steps: Step[] = []
    let addMore = true

    while (addMore) {
      console.log(`\n  Step ${steps.length + 1}`)
      const id = (await prompt(rl, '    id (e.g. fetch): ')).trim()
      const agent = (await prompt(rl, '    agent name: ')).trim()
      const stepPrompt = (await prompt(rl, '    prompt: ')).trim()
      const depsRaw = (await prompt(rl, '    dependsOn (comma-separated ids, or blank): ')).trim()
      const dependsOn = depsRaw ? depsRaw.split(',').map((s) => s.trim()).filter(Boolean) : []

      steps.push({ id, agent, prompt: stepPrompt, dependsOn })

      const more = (await prompt(rl, '\n  Add another step? [y/N] ')).trim().toLowerCase()
      addMore = more === 'y' || more === 'yes'
    }

    const plan = PlanSchema.parse({ version: '1.0', name, steps })

    const outPath = resolve(cwd, 'af-plan.json')
    const exists = await access(outPath).then(() => true).catch(() => false)
    if (exists) {
      const overwrite = (await prompt(rl, `\n  ${outPath} already exists. Overwrite? [y/N] `))
        .trim()
        .toLowerCase()
      if (overwrite !== 'y' && overwrite !== 'yes') {
        throw new Error('Aborted: file not overwritten')
      }
    }

    await writeFile(outPath, JSON.stringify(plan, null, 2) + '\n', 'utf8')
    console.log(`\n  Written: ${outPath}\n`)
    return plan
  }
}
