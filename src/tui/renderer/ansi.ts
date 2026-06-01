/** ANSI escape sequence builders. All output goes through these — never raw strings. */

export const ESC = '\x1b'
export const CSI = `${ESC}[`

// Screen
export const enterAltScreen = (): string => `${CSI}?1049h`
export const exitAltScreen = (): string => `${CSI}?1049l`
export const clearScreen = (): string => `${CSI}2J`
export const hideCursor = (): string => `${CSI}?25l`
export const showCursor = (): string => `${CSI}?25h`

// Mouse
export const enableMouse = (): string =>
  `${CSI}?1000h${CSI}?1002h${CSI}?1006h`
export const disableMouse = (): string =>
  `${CSI}?1000l${CSI}?1002l${CSI}?1006l`

// Cursor movement (1-indexed)
export const moveTo = (row: number, col: number): string =>
  `${CSI}${row};${col}H`

// SGR — Select Graphic Rendition
export const sgr = (...codes: number[]): string =>
  `${CSI}${codes.join(';')}m`

export const reset = (): string => sgr(0)

// 4-bit colors
export const fg = (code: number): string => sgr(30 + code)
export const bg = (code: number): string => sgr(40 + code)
export const fgBright = (code: number): string => sgr(90 + code)
export const bgBright = (code: number): string => sgr(100 + code)

// 256-color
export const fg256 = (n: number): string => sgr(38, 5, n)
export const bg256 = (n: number): string => sgr(48, 5, n)

// Truecolor
export const fgRgb = (r: number, g: number, b: number): string =>
  sgr(38, 2, r, g, b)
export const bgRgb = (r: number, g: number, b: number): string =>
  sgr(48, 2, r, g, b)

export const bold = (): string => sgr(1)
export const dim = (): string => sgr(2)
export const underline = (): string => sgr(4)
export const reverse = (): string => sgr(7)

export const clearLine = (): string => `${CSI}2K`
export const clearToEol = (): string => `${CSI}0K`

// Bracketed paste — wraps pasted text in ESC[200~...ESC[201~ so it is not
// misinterpreted as keystrokes (e.g. a pasted newline won't accidentally submit)
export const enableBracketedPaste  = (): string => `${CSI}?2004h`
export const disableBracketedPaste = (): string => `${CSI}?2004l`

// OSC 8 hyperlinks (supported by most modern terminals)
const OSC = `${ESC}]`
const ST  = `${ESC}\\`  // String Terminator
export const osc8Open  = (url: string): string => `${OSC}8;;${url}${ST}`
export const osc8Close = (): string => `${OSC}8;;${ST}`
