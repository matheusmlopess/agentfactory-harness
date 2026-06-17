import { describe, it, expect, beforeEach } from 'vitest'
import { Logger, formatLogEntry, getLogFilePath, getRecentLogs, clearLogBuffer, getLogSources } from './logger.js'

describe('Logger', () => {
  beforeEach(() => {
    clearLogBuffer()
  })

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

  it('stores logs in memory buffer and retrieves them', () => {
    const log1 = new Logger('Panel1')
    const log2 = new Logger('Panel2')

    log1.info('event 1')
    log2.info('event 2')
    log1.info('event 3')

    const all = getRecentLogs()
    expect(all.length).toBeGreaterThanOrEqual(3)
  })

  it('filters logs by source', () => {
    const log1 = new Logger('App')
    const log2 = new Logger('SessionPanel')

    log1.info('app event')
    log2.info('session event')
    log1.warn('app warning')

    const appLogs = getRecentLogs('App')
    const sessionLogs = getRecentLogs('SessionPanel')

    expect(appLogs.length).toBeGreaterThanOrEqual(2)
    expect(sessionLogs.length).toBeGreaterThanOrEqual(1)
    expect(appLogs.some(e => e.message === 'app event')).toBe(true)
    expect(sessionLogs.some(e => e.message === 'session event')).toBe(true)
  })

  it('returns unique log sources', () => {
    const log1 = new Logger('App')
    const log2 = new Logger('SessionPanel')

    log1.info('event 1')
    log2.info('event 2')
    log1.info('event 3')

    const sources = getLogSources()
    expect(sources).toContain('App')
    expect(sources).toContain('SessionPanel')
  })
})
