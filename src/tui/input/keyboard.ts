export interface KeyEvent {
  key: string        // 'a', 'enter', 'escape', 'ctrl+c', 'arrow_up', etc.
  raw: Buffer
}

const SPECIAL: Record<string, string> = {
  '\r':       'enter',
  '\n':       'enter',
  '\x1b':     'escape',
  '\x7f':     'backspace',
  '\x08':     'backspace',
  '\t':       'tab',
  '\x1b[A':   'arrow_up',
  '\x1b[B':   'arrow_down',
  '\x1b[C':   'arrow_right',
  '\x1b[D':   'arrow_left',
  '\x1b[H':   'home',
  '\x1b[F':   'end',
  '\x1b[5~':  'page_up',
  '\x1b[6~':  'page_down',
  '\x1b[2~':  'insert',
  '\x1b[3~':  'delete',
}

/** Parse a raw stdin buffer chunk into a KeyEvent (if it's a keyboard event). */
export function parseKey(data: Buffer): KeyEvent | null {
  const str = data.toString('utf8')

  // Skip SGR mouse events — handled by mouse.ts
  if (str.startsWith('\x1b[<')) return null
  if (str.startsWith('\x1b[M')) return null

  // Ctrl+letter
  if (data.length === 1 && data[0]! < 32 && data[0]! !== 27) {
    const letter = String.fromCharCode(data[0]! + 64).toLowerCase()
    return { key: `ctrl+${letter}`, raw: data }
  }

  const special = SPECIAL[str]
  if (special) return { key: special, raw: data }

  // Printable character
  if (str.length === 1 && str >= ' ') {
    return { key: str, raw: data }
  }

  return null
}
