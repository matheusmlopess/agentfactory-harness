import { describe, it, expect } from 'vitest'
import { ScrollableList, type ListRow } from './ScrollableList.js'

const rows = (n: number): ListRow[] =>
  Array.from({ length: n }, (_, i) => ({ text: `item-${i}` }))

describe('ScrollableList — clamp navigation (default convention)', () => {
  it('clamps at both ends', () => {
    const l = new ScrollableList(5)
    l.setRows(rows(3))
    l.moveUp()
    expect(l.selectedIndex).toBe(0)
    l.moveDown(); l.moveDown(); l.moveDown(); l.moveDown()
    expect(l.selectedIndex).toBe(2)
  })

  it('skips header rows during navigation and initial selection', () => {
    const l = new ScrollableList(10)
    l.setRows([{ text: 'H', header: true }, { text: 'a' }, { text: 'H2', header: true }, { text: 'b' }])
    expect(l.selectedIndex).toBe(1)
    l.moveDown()
    expect(l.selectedIndex).toBe(3)
    l.moveUp()
    expect(l.selectedIndex).toBe(1)
  })
})

describe('ScrollableList — wrap navigation (documented exception)', () => {
  it('wraps modulo at both ends', () => {
    const l = new ScrollableList({ visibleRows: 5, wrap: true })
    l.setRows(rows(3))
    l.moveUp()
    expect(l.selectedIndex).toBe(2)
    l.moveDown()
    expect(l.selectedIndex).toBe(0)
  })

  it('wrap skips headers', () => {
    const l = new ScrollableList({ visibleRows: 5, wrap: true })
    l.setRows([{ text: 'H', header: true }, { text: 'a' }, { text: 'b' }])
    expect(l.selectedIndex).toBe(1)
    l.moveUp()   // wraps past header to 'b'
    expect(l.selectedIndex).toBe(2)
    l.moveDown() // wraps past header to 'a'
    expect(l.selectedIndex).toBe(1)
  })
})

describe('ScrollableList — wheel semantics', () => {
  it('viewport mode moves the offset, never the selection', () => {
    const l = new ScrollableList({ visibleRows: 3, wheel: 'viewport' })
    l.setRows(rows(10))
    l.onWheel('down')
    expect(l.scrollTop).toBe(1)
    expect(l.selectedIndex).toBe(0)
    l.onWheel('up'); l.onWheel('up')
    expect(l.scrollTop).toBe(0)
  })

  it('wheelStep 3 scrolls three rows per tick (text-pane convention)', () => {
    const l = new ScrollableList({ visibleRows: 3, wheelStep: 3 })
    l.setRows(rows(10))
    l.onWheel('down')
    expect(l.scrollTop).toBe(3)
  })

  it('selection mode moves the selection', () => {
    const l = new ScrollableList({ visibleRows: 3, wheel: 'selection' })
    l.setRows(rows(10))
    l.onWheel('down')
    expect(l.selectedIndex).toBe(1)
    l.onWheel('up')
    expect(l.selectedIndex).toBe(0)
  })

  it('viewport scroll clamps at the last window', () => {
    const l = new ScrollableList({ visibleRows: 3 })
    l.setRows(rows(5))
    for (let i = 0; i < 10; i++) l.onWheel('down')
    expect(l.scrollTop).toBe(2)
  })
})

describe('ScrollableList — legacy numeric constructor', () => {
  it('new ScrollableList(8) still works (visibleRows)', () => {
    const l = new ScrollableList(8)
    l.setRows(rows(20))
    expect(l.shownCount).toBe(8)
    expect(l.isScrollable).toBe(true)
  })
})

describe('ScrollableList — click mapping', () => {
  it('selectAtViewportRow selects content rows, rejects headers and out-of-range', () => {
    const l = new ScrollableList(5)
    l.setRows([{ text: 'H', header: true }, { text: 'a' }, { text: 'b' }])
    expect(l.selectAtViewportRow(0)).toBe(-1)
    expect(l.selectAtViewportRow(1)).toBe(1)
    expect(l.selectedIndex).toBe(1)
    expect(l.selectAtViewportRow(9)).toBe(-1)
  })
})
