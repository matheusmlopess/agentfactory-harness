export interface KeyEvent {
  key: string        // 'a', 'enter', 'escape', 'ctrl+c', 'arrow_up', etc.
  raw: Buffer
}

const SPECIAL: Record<string, string> = {
  '\r':         'enter',
  '\n':         'enter',
  '\r\n':       'enter',   // Windows Terminal / ConPTY sends CR+LF as one chunk
  '\x1b':       'escape',
  '\x7f':       'backspace',
  '\x08':       'backspace',
  '\t':         'tab',
  '\x1b[A':     'arrow_up',
  '\x1b[B':     'arrow_down',
  '\x1b[C':     'arrow_right',
  '\x1b[D':     'arrow_left',
  '\x1b[H':     'home',
  '\x1b[F':     'end',
  '\x1b[5~':    'page_up',
  '\x1b[6~':    'page_down',
  '\x1b[2~':    'insert',
  '\x1b[3~':    'delete',
  '\x1bOP':     'f1',
  '\x1bOQ':     'f2',
  '\x1bOR':     'f3',
  '\x1bOS':     'f4',
  '\x1b[11~':   'f1',
  '\x1b[12~':   'f2',
  '\x1b[13~':   'f3',
  '\x1b[14~':   'f4',
  '\x1b[15~':   'f5',
}

/** Parse a raw stdin buffer chunk into a KeyEvent (if it's a keyboard event). */
export function parseKey(data: Buffer): KeyEvent | null {
  const str = data.toString('utf8')

  // Skip SGR mouse events — handled by mouse.ts
  if (str.startsWith('\x1b[<')) return null
  if (str.startsWith('\x1b[M')) return null

  // SPECIAL table first — covers \r (enter), \n (enter), \t (tab),
  // \x08/\x7f (backspace), escape sequences, and function keys.
  // Must run before the ctrl-letter check so that \r, \t, \x08 etc.
  // don't get mis-labelled as ctrl+m / ctrl+i / ctrl+h.
  const special = SPECIAL[str]
  if (special) return { key: special, raw: data }

  // Ctrl+letter: bytes 0x01–0x1A (Ctrl+A … Ctrl+Z).
  // Bytes outside that range (\r=0x0D, \t=0x09, \x08, \x1b) are already
  // handled above or intentionally ignored here.
  if (data.length === 1 && data[0]! >= 1 && data[0]! <= 26) {
    const letter = String.fromCharCode(data[0]! + 64).toLowerCase()
    return { key: `ctrl+${letter}`, raw: data }
  }

  // Printable character
  if (str.length === 1 && str >= ' ') {
    return { key: str, raw: data }
  }

  return null
}
