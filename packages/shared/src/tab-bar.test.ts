import { describe, it, expect } from 'vitest'
import { tabBarHit, tabLabelSpans, EXIT_BTN } from './tab-bar.js'

const TABS = ['Session', 'Orchestration', 'Agents', 'Terminal', 'Config', 'Logs']

describe('tabLabelSpans', () => {
  it('lays out labels from column 1 with 1-col gaps', () => {
    const spans = tabLabelSpans(TABS)
    expect(spans[0]).toEqual({ col: 1, width: 9 })            // ' Session '
    expect(spans[1]).toEqual({ col: 11, width: 15 })          // ' Orchestration '
    // each next span starts after previous width + 1 gap
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i]!.col).toBe(spans[i - 1]!.col + spans[i - 1]!.width + 1)
    }
  })
})

describe('tabBarHit', () => {
  it('hits each tab across its full label span', () => {
    const spans = tabLabelSpans(TABS)
    for (let i = 0; i < TABS.length; i++) {
      const s = spans[i]!
      expect(tabBarHit(s.col, 120, TABS)).toEqual({ kind: 'tab', index: i })
      expect(tabBarHit(s.col + s.width - 1, 120, TABS)).toEqual({ kind: 'tab', index: i })
    }
  })

  it('misses the gap between tabs', () => {
    const spans = tabLabelSpans(TABS)
    expect(tabBarHit(spans[0]!.col + spans[0]!.width, 120, TABS)).toEqual({ kind: 'none' })
    expect(tabBarHit(0, 120, TABS)).toEqual({ kind: 'none' })
  })

  it('hits the right-aligned exit button', () => {
    const cols = 120
    const exitCol = cols - EXIT_BTN.length - 1
    expect(tabBarHit(exitCol, cols, TABS)).toEqual({ kind: 'exit' })
    expect(tabBarHit(exitCol + EXIT_BTN.length - 1, cols, TABS)).toEqual({ kind: 'exit' })
    expect(tabBarHit(exitCol - 1, cols, TABS)).toEqual({ kind: 'none' })
  })

  it('exit button wins over a tab label when the terminal is narrow enough to overlap', () => {
    // At 40 cols the exit button overlaps the later tab labels — exit is checked first
    const cols = 40
    const exitCol = cols - EXIT_BTN.length - 1
    expect(tabBarHit(exitCol, cols, TABS).kind).toBe('exit')
  })
})
