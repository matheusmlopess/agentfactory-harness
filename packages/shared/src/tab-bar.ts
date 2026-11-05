/**
 * Pure tab-bar geometry — extracted from app.ts so tab hit-testing is
 * testable without a TTY. The tab bar renders each label as ` Title `
 * starting at column 1 with a 1-column gap, plus a right-aligned exit button.
 */

export const EXIT_BTN = ' ✕ Quit '

export type TabHit =
  | { kind: 'tab'; index: number }
  | { kind: 'exit' }
  | { kind: 'none' }

export interface TabSpan {
  col: number
  width: number
}

/** Column span of each rendered tab label (` Title `), in order. */
export function tabLabelSpans(tabs: readonly string[]): TabSpan[] {
  const spans: TabSpan[] = []
  let col = 1
  for (const title of tabs) {
    const width = title.length + 2
    spans.push({ col, width })
    col += width + 1
  }
  return spans
}

/** Classify a click at (row 0, col) against the tab labels and exit button. */
export function tabBarHit(col: number, cols: number, tabs: readonly string[]): TabHit {
  const exitCol = cols - EXIT_BTN.length - 1
  if (col >= exitCol && col < exitCol + EXIT_BTN.length) return { kind: 'exit' }
  const spans = tabLabelSpans(tabs)
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i]!
    if (col >= s.col && col < s.col + s.width) return { kind: 'tab', index: i }
  }
  return { kind: 'none' }
}
