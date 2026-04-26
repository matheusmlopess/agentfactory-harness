#!/usr/bin/env node
import { buildCli } from './cli.js'
import { App } from './app.js'

const VERSION = '0.1.0'

const program = buildCli(VERSION)

// If a subcommand was given, let commander handle it
if (process.argv.length > 2 && !process.argv[2]?.startsWith('-')) {
  program.parse(process.argv)
} else if (process.argv.includes('--version') || process.argv.includes('-v')) {
  program.parse(process.argv)
} else {
  // No subcommand — launch the full-screen TUI
  const app = new App()
  app.start()
}
