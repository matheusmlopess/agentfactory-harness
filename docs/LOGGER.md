<!-- version: 1.0.0 -->
# Logger Feature — AgentFactory Harness

Comprehensive logging system for debugging, monitoring, and auditing app behavior.

---

## Overview

The logger writes structured JSON logs to `~/.config/agentfactory/logs/factory-YYYY-MM-DD.log` with configurable verbosity. Logs are non-blocking (async) and safe for TUI rendering.

**Features**:
- Structured JSON logging (timestamp, level, source, message, metadata)
- Multiple log levels: DEBUG, INFO, WARN, ERROR
- Daily log rotation (one file per day)
- Environment-configurable verbosity
- Non-blocking writes (async)
- Zero performance impact when disabled

---

## Quick Start

### Basic Usage

```typescript
import { logger } from './core/logger.js'

const log = logger('MyModule')

log.info('operation started', { userId: 'abc123' })
log.error('connection failed', { host: 'api.example.com', code: 'ECONNREFUSED' })
```

### Output

Logs are written as JSON, one per line:

```json
{"timestamp":"2026-06-09T14:30:00.123Z","level":"INFO","source":"MyModule","message":"operation started","meta":{"userId":"abc123"}}
{"timestamp":"2026-06-09T14:30:05.456Z","level":"ERROR","source":"MyModule","message":"connection failed","meta":{"host":"api.example.com","code":"ECONNREFUSED"}}
```

---

## Configuration

### Environment Variables

| Variable | Values | Default | Purpose |
|----------|--------|---------|---------|
| `FACTORY_LOG_LEVEL` | `DEBUG`, `INFO`, `WARN`, `ERROR` | `INFO` | Minimum log level to write |
| `FACTORY_DEBUG` | `true`/`false` | — | Also log to console (useful in dev mode) |
| `NODE_ENV` | `development` | — | Auto-enable console logging if set |

### Examples

```bash
# Verbose debugging (all DEBUG+ messages)
FACTORY_LOG_LEVEL=DEBUG factory

# Only errors and warnings
FACTORY_LOG_LEVEL=WARN factory

# Development mode (logs to both file and console)
FACTORY_DEBUG=true factory

# Or set in Node
NODE_ENV=development factory
```

---

## Log Levels

### DEBUG
Detailed diagnostic information. Off by default (expensive to write).

```typescript
log.debug('keyboard event parsed', { key: 'Enter', ctrl: true, meta: {} })
```

### INFO
General informational messages. Tracks important app state changes.

```typescript
log.info('session started', { name: 'Einstein', model: 'claude-opus-4-8' })
log.info('user logged in', { handle: 'alice' })
```

### WARN
Warning messages for unexpected but recoverable conditions.

```typescript
log.warn('API rate limit approaching', { remaining: 5 })
log.warn('token expiring soon', { expiresIn: '2 hours' })
```

### ERROR
Error messages for failures that need attention.

```typescript
log.error('API request failed', { url: 'https://api.example.com', status: 500 })
log.error('failed to save config', { error: 'EACCES', path: '/root/.config' })
```

---

## Log File Location

Logs are stored daily in:

```
~/.config/agentfactory/logs/factory-YYYY-MM-DD.log
```

Example:
```
~/.config/agentfactory/logs/factory-2026-06-09.log
~/.config/agentfactory/logs/factory-2026-06-10.log
```

Retrieve the path programmatically:

```typescript
import { getLogFilePath } from './core/logger.js'

const logPath = getLogFilePath()
console.log('Logs at:', logPath)
```

---

## Common Logging Patterns

### API Calls

```typescript
log.info('api request', {
  method: 'POST',
  endpoint: '/auth/cli/device',
  statusCode: 200,
  duration: '123ms'
})
```

### User Input

```typescript
log.debug('input received', {
  type: 'keypress',
  key: 'Enter',
  inputBufLength: 45
})
```

### Tool Execution

```typescript
log.info('tool executed', {
  tool: 'bash',
  command: 'ls -la',
  exitCode: 0,
  duration: '45ms'
})
```

### State Changes

```typescript
log.info('session state changed', {
  sessionId: 'einstein-2026-06-09',
  from: 'idle',
  to: 'running',
  model: 'claude-opus-4-8'
})
```

### Errors

```typescript
log.error('uncaught exception', {
  error: err.message,
  stack: err.stack,
  source: 'sessionPanel.handleKey'
})
```

---

## Debugging with Logs

### Tail logs in real-time

```bash
tail -f ~/.config/agentfactory/logs/factory-$(date +%Y-%m-%d).log
```

### Search logs for errors

```bash
grep '"level":"ERROR"' ~/.config/agentfactory/logs/factory-*.log
```

### Parse logs with jq

```bash
# Pretty-print all INFO logs from SessionPanel
grep '"level":"INFO"' factory-2026-06-09.log | \
  grep '"source":"SessionPanel"' | \
  jq '.'

# Count errors by source
grep '"level":"ERROR"' factory-2026-06-09.log | \
  jq -s 'group_by(.source) | map({source: .[0].source, count: length})'
```

### Monitor app startup

```bash
FACTORY_LOG_LEVEL=DEBUG factory &
sleep 1
tail -20 ~/.config/agentfactory/logs/factory-$(date +%Y-%m-%d).log
```

---

## Performance Considerations

### Overhead

- **File I/O**: Async, non-blocking (does not stall TUI render)
- **Memory**: Minimal (no buffering, writes directly to disk)
- **CPU**: Negligible (JSON formatting is fast)

### Best Practices

1. **Avoid verbose logging in hot loops** — batch updates if possible
2. **Use appropriate log levels** — DEBUG for detailed traces, INFO for state changes
3. **Include context in metadata** — helps debugging later
4. **Avoid logging sensitive data** — tokens, passwords, API keys

### Example (Good)

```typescript
// ✓ Logs once per session state change, with context
log.info('session state changed', { from: prev, to: current })

// ✗ Logs on every render (thousands/sec, wasteful)
// log.debug('render frame', { row: r, col: c })
```

---

## Integration Points

The logger is integrated at:

- **App startup** (`src/app.ts`) — logs initialization steps
- **Auth flows** (`src/registry/`) — logs login/logout/key import
- **Session events** (`src/tui/panels/SessionPanel.ts`) — logs state changes
- **API calls** (`src/registry/client.ts`) — logs requests/responses

Feel free to add logging to other modules for debugging.

---

## Logger API

```typescript
import { logger, getLogFilePath, formatLogEntry, Logger } from './core/logger.js'

// Create a logger instance
const log = logger('MyModule')

// Log methods
log.debug(message: string, meta?: object): void
log.info(message: string, meta?: object): void
log.warn(message: string, meta?: object): void
log.error(message: string, meta?: object): void

// Utilities
getLogFilePath(): string  // Get today's log file path
formatLogEntry(entry: LogEntry): string  // Manual JSON formatting
```

---

## Tests

Logger tests are in `src/core/logger.test.ts` (6 cases):
- Logger instantiation
- JSON formatting (with/without metadata)
- Log level checks
- File path validation
- API surface

Run tests:
```bash
npm test src/core/logger.test.ts
```

---

## Troubleshooting

### Logs not appearing in file

**Cause**: Log directory permission issue  
**Fix**: Check `~/.config/agentfactory/logs/` exists and is writable

```bash
mkdir -p ~/.config/agentfactory/logs
chmod 755 ~/.config/agentfactory/logs
```

### Logs not showing on console

**Cause**: `FACTORY_DEBUG` not set and `NODE_ENV` not `development`  
**Fix**: Enable debug mode

```bash
FACTORY_DEBUG=true factory
```

### Too many logs (disk space)

**Cause**: `FACTORY_LOG_LEVEL=DEBUG` generates many logs  
**Fix**: Use `INFO` (default) or `WARN` level; clean up old logs

```bash
# Use INFO level (default)
FACTORY_LOG_LEVEL=INFO factory

# Clean up logs older than 30 days
find ~/.config/agentfactory/logs/ -mtime +30 -delete
```

---

## Future Enhancements

Potential improvements (not yet implemented):

- [ ] Log rotation (compress and archive daily logs)
- [ ] Log filtering UI (`/logs` command with search)
- [ ] Structured metrics export (JSON metrics for monitoring)
- [ ] Remote logging (send logs to server for analysis)
- [ ] Crash report generation (auto-collect logs on uncaught exception)
