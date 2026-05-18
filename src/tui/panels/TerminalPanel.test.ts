import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IPty } from 'node-pty'

// --- Mock node-pty before importing TerminalPanel ---
let mockOnData: ((chunk: string) => void) | null = null
let mockOnExit: (() => void) | null = null
let spawnedCols = 0
let spawnedRows = 0
const mockPty: IPty = {
  cols: 0,
  rows: 0,
  pid: 1,
  process: 'bash',
  handleFlowControl: false,
  onData: vi.fn((cb: (data: string) => void) => {
    mockOnData = cb
    return { dispose: vi.fn() }
  }) as unknown as IPty['onData'],
  onExit: vi.fn((cb: () => void) => {
    mockOnExit = cb
    return { dispose: vi.fn() }
  }) as unknown as IPty['onExit'],
  write: vi.fn(),
  resize: vi.fn((cols: number, rows: number) => {
    mockPty.cols = cols
    mockPty.rows = rows
  }),
  kill: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}

vi.mock('node-pty', () => ({
  spawn: vi.fn((_shell: string, _args: string[], opts: { cols: number; rows: number }) => {
    spawnedCols = opts.cols
    spawnedRows = opts.rows
    return mockPty
  }),
}))

// Now import after mock is in place
const { TerminalPanel } = await import('./TerminalPanel.js')

// Minimal CellBuffer stub
class StubBuf {
  writes: Array<{ row: number; col: number; text: string }> = []
  write(row: number, col: number, text: string): void { this.writes.push({ row, col, text }) }
  fill(): void {}
  diff(): string { return '' }
  clone(): this { return this }
}

describe('TerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnData = null
    mockOnExit = null
  })

  it('spawns PTY with correct dimensions from inner rect', () => {
    // rect 10 rows × 20 cols; inner = 8 rows × 18 cols (minus 1-border each side)
    const _panel = new TerminalPanel({ row: 0, col: 0, height: 10, width: 20 }, vi.fn())
    // inner height = 10-2=8, width = 20-2=18
    expect(spawnedRows).toBe(8)
    expect(spawnedCols).toBe(18)
  })

  it('feeds PTY data into VTScreen and schedules a render', () => {
    const schedule = vi.fn()
    const _panel = new TerminalPanel({ row: 0, col: 0, height: 10, width: 20 }, schedule)
    mockOnData!('Hello')
    expect(schedule).toHaveBeenCalled()
  })

  it('schedules render on PTY exit', () => {
    const schedule = vi.fn()
    const panel = new TerminalPanel({ row: 0, col: 0, height: 10, width: 20 }, schedule)
    schedule.mockClear()
    mockOnExit!()
    expect(schedule).toHaveBeenCalled()
    // write after exit should be no-op
    panel.write(Buffer.from('x'))
    expect(mockPty.write).not.toHaveBeenCalled()
  })

  it('resize calls pty.resize and screen.resize', () => {
    const panel = new TerminalPanel({ row: 0, col: 0, height: 10, width: 20 }, vi.fn())
    panel.resize(12, 40)
    expect(mockPty.resize).toHaveBeenCalledWith(40, 12)
  })

  it('destroy kills the PTY', () => {
    const panel = new TerminalPanel({ row: 0, col: 0, height: 10, width: 20 }, vi.fn())
    panel.destroy()
    expect(mockPty.kill).toHaveBeenCalled()
    // second destroy is a no-op
    panel.destroy()
    expect(mockPty.kill).toHaveBeenCalledTimes(1)
  })

  it('write forwards bytes to pty', () => {
    const panel = new TerminalPanel({ row: 0, col: 0, height: 10, width: 20 }, vi.fn())
    panel.write(Buffer.from('ls\n'))
    expect(mockPty.write).toHaveBeenCalledWith('ls\n')
  })

  it('render shows exit message after PTY exits', () => {
    const panel = new TerminalPanel({ row: 0, col: 0, height: 10, width: 20 }, vi.fn())
    mockOnExit!()
    const buf = new StubBuf()
    panel.render(buf as never)
    const hasExitMsg = buf.writes.some((w) => w.text.includes('exited'))
    expect(hasExitMsg).toBe(true)
  })
})
