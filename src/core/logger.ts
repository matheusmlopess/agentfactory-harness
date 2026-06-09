import { appendFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

interface LogEntry {
  timestamp: string
  level: LogLevel
  source: string
  message: string
  meta?: Record<string, unknown>
}

const LOG_DIR = join(homedir(), '.config', 'agentfactory', 'logs')
const LOG_FILE = join(LOG_DIR, `factory-${new Date().toISOString().split('T')[0]}.log`)

// Environment-based log level (default: INFO)
const MIN_LOG_LEVEL: LogLevel = (process.env['FACTORY_LOG_LEVEL'] as LogLevel) ?? 'INFO'
const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

let logFileReady = false

async function ensureLogDir(): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true })
    logFileReady = true
  } catch (err) {
    console.error('Failed to create log directory:', err)
  }
}

// Initialize log dir on module load
void ensureLogDir()

/**
 * Format log entry as JSON for structured logging.
 * Example: {"timestamp":"2026-06-09T14:30:00Z","level":"ERROR","source":"SessionPanel","message":"Tool error","meta":{"tool":"bash","code":1}}
 */
export function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry)
}

/**
 * Write log entry to disk (non-blocking).
 */
async function writeLogFile(entry: LogEntry): Promise<void> {
  if (!logFileReady) return

  try {
    const line = formatLogEntry(entry) + '\n'
    await appendFile(LOG_FILE, line, { encoding: 'utf8' })
  } catch (err) {
    // Silently fail on log write errors to avoid infinite loops
    console.error('Log write failed:', err)
  }
}

export class Logger {
  private source: string

  constructor(source: string) {
    this.source = source
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    // Check if this log level should be emitted
    if (LOG_LEVELS[level] < LOG_LEVELS[MIN_LOG_LEVEL]) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source: this.source,
      message,
      ...(meta && { meta }),
    }

    // Log to console in dev mode
    if (process.env['NODE_ENV'] === 'development' || process.env['FACTORY_DEBUG']) {
      const prefix = `[${level}] ${this.source}:`
      if (meta) {
        console.log(prefix, message, meta)
      } else {
        console.log(prefix, message)
      }
    }

    // Always write to file (async, non-blocking)
    void writeLogFile(entry)
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('DEBUG', message, meta)
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('INFO', message, meta)
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('WARN', message, meta)
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('ERROR', message, meta)
  }
}

/**
 * Get or create a logger for a given source name.
 * Usage: const log = logger('SessionPanel'); log.info('session started', { name: 'Einstein' })
 */
export function logger(source: string): Logger {
  return new Logger(source)
}

/**
 * Utility to get the log file path for inspection.
 * Useful for `factory doctor` or manual debugging.
 */
export function getLogFilePath(): string {
  return LOG_FILE
}
