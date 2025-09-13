import { describe, it, expect, vi } from 'vitest'

interface Item { ev: { type: string }; absIndex: number }

function setup(filtered: Item[]) {
  const map = new Map<number, number>()
  filtered.forEach((it, idx) => {
    if (it.ev.type === 'LocalShellCall') map.set(it.absIndex, idx)
  })
  let scrollToIndex: number | null = null
  function jump(absIdx: number) {
    const mapped = map.get(absIdx)
    if (mapped != null) {
      scrollToIndex = mapped
      setTimeout(() => { scrollToIndex = null }, 0)
    }
  }
  return { jump, getScroll: () => scrollToIndex }
}

describe('command jump mapping', () => {
  it('works without filters', async () => {
    vi.useFakeTimers()
    const full: Item[] = [
      { ev: { type: 'LocalShellCall' }, absIndex: 0 },
      { ev: { type: 'LocalShellCall' }, absIndex: 1 },
    ]
    const { jump, getScroll } = setup(full)
    jump(1)
    expect(getScroll()).toBe(1)
    await vi.runAllTimersAsync()
    expect(getScroll()).toBeNull()
    vi.useRealTimers()
  })

  it('accounts for active timeline filters', async () => {
    vi.useFakeTimers()
    const full: Item[] = [
      { ev: { type: 'LocalShellCall' }, absIndex: 0 },
      { ev: { type: 'Message' }, absIndex: 1 },
      { ev: { type: 'LocalShellCall' }, absIndex: 2 },
    ]
    const filtered = [full[0]!, full[2]!]
    const { jump, getScroll } = setup(filtered)
    jump(2)
    expect(getScroll()).toBe(1)
    await vi.runAllTimersAsync()
    expect(getScroll()).toBeNull()
    vi.useRealTimers()
  })
})
