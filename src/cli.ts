import { Command } from 'commander'
import { runDoctor, printDoctorReport } from './harness/doctor.js'

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

  return program
}
