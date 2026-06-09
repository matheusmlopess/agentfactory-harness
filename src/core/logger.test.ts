import { describe, it, expect } from 'vitest'
import { Logger, formatLogEntry, getLogFilePath } from './logger.js'

describe('Logger', () => {
  it('creates a logger with a source name', () => {
    const log = new Logger('TestModule')
    expect(log).toBeDefined()
  })

  it('formats log entries as JSON', () => {
    const entry = {
      timestamp: '2026-06-09T14:30:00Z',
      level: 'INFO' as const,
      source: 'SessionPanel',
      message: 'User sent message',
      meta: { tokens: 245 },
    }

    const formatted = formatLogEntry(entry)
    const parsed = JSON.parse(formatted)

    expect(parsed.timestamp).toBe('2026-06-09T14:30:00Z')
    expect(parsed.level).toBe('INFO')
    expect(parsed.source).toBe('SessionPanel')
    expect(parsed.message).toBe('User sent message')
    expect(parsed.meta.tokens).toBe(245)
  })

  it('formats log entries without meta', () => {
    const entry = {
      timestamp: '2026-06-09T14:30:00Z',
      level: 'DEBUG' as const,
      source: 'App',
      message: 'Startup',
    }

    const formatted = formatLogEntry(entry)
    const parsed = JSON.parse(formatted)

    expect(parsed.timestamp).toBeDefined()
    expect(parsed.level).toBe('DEBUG')
    expect(parsed.message).toBe('Startup')
    expect(parsed.meta).toBeUndefined()
  })

  it('has methods for each log level', () => {
    const log = new Logger('Test')

    expect(typeof log.debug).toBe('function')
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
  })

  it('returns a valid log file path', () => {
    const path = getLogFilePath()

    expect(path).toBeDefined()
    expect(path).toContain('.config/agentfactory/logs')
    expect(path).toContain('factory-')
    expect(path).toContain('.log')
  })

  it('logs can include metadata objects', () => {
    const log = new Logger('SessionPanel')

    // Verify that meta is accepted (the actual writing is async and tested separately)
    expect(() => {
      log.info('session started', { name: 'Einstein', model: 'claude-opus' })
    }).not.toThrow()
  })
})
