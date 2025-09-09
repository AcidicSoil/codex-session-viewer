import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

export interface TimelineViewProps<T> {
  items: readonly T[]
  height?: number // px; default 600
  estimateItemHeight?: number // px; default 80
  overscanPx?: number // default 400
  renderItem: (item: T, index: number) => React.ReactNode
  keyForIndex?: (item: T, index: number) => React.Key
  className?: string
  // Optional: when provided, scrolls to this index when it changes
  scrollToIndex?: number | null
}

function useRafThrottle(fn: () => void) {
  const ticking = useRef(false)
  return useCallback(() => {
    if (ticking.current) return
    ticking.current = true
    requestAnimationFrame(() => {
      ticking.current = false
      fn()
    })
  }, [fn])
}

function lowerBound(prefix: ReadonlyArray<number>, target: number) {
  let lo = 0, hi = prefix.length - 1, ans = prefix.length
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (prefix[mid]! >= target) {
      ans = mid
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }
  return ans
}

export function TimelineView<T>({
  items,
  height = 600,
  estimateItemHeight = 80,
  overscanPx = 400,
  renderItem,
  keyForIndex,
  className,
  scrollToIndex = null,
}: TimelineViewProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [measured, setMeasured] = useState<Map<number, number>>(new Map())

  const onScroll = useRafThrottle(() => {
    const el = containerRef.current
    if (el) setScrollTop(el.scrollTop)
  })

  // Build heights array using estimates with measured overrides
  const { heights, offsets, totalHeight } = useMemo(() => {
    const n = items.length
    const h = new Array<number>(n)
    for (let i = 0; i < n; i++) h[i] = measured.get(i) ?? estimateItemHeight
    const off = new Array<number>(n)
    let acc = 0
    for (let i = 0; i < n; i++) {
      off[i] = acc
      acc += h[i]!
    }
    return { heights: h, offsets: off, totalHeight: acc }
  }, [items.length, measured, estimateItemHeight])

  const start = useMemo(() => {
    const target = Math.max(0, scrollTop - overscanPx)
    const idx = lowerBound(offsets, target)
    return Math.max(0, Math.min(idx, items.length - 1))
  }, [offsets, scrollTop, overscanPx, items.length])

  const end = useMemo(() => {
    const target = Math.min(totalHeight, scrollTop + height + overscanPx)
    // find first offset >= (target), then back one
    const idx = lowerBound(offsets, target)
    return Math.max(start, Math.min(items.length - 1, idx))
  }, [offsets, totalHeight, scrollTop, height, overscanPx, items.length, start])

  const visible: number[] = []
  for (let i = start; i <= end; i++) visible.push(i)

  const handleMeasured = useCallback((index: number, h: number) => {
    const prev = measured.get(index) ?? 0
    // Update only if difference is meaningful to reduce churn
    if (Math.abs(prev - h) > 1) {
      setMeasured((m) => {
        const next = new Map(m)
        next.set(index, h)
        return next
      })
    }
  }, [measured])

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      style={{ height, overflowY: 'auto', position: 'relative' }}
      className={className}
    >
      {(() => {
        // Programmatic scroll on demand
        const el = containerRef.current
        if (el && scrollToIndex != null && scrollToIndex >= 0 && scrollToIndex < items.length) {
          const top = offsets[scrollToIndex] ?? 0
          // Avoid thrashing; only adjust if significantly off
          if (Math.abs(el.scrollTop - top) > 4) {
            el.scrollTop = top
          }
        }
        return null
      })()}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visible.map((i) => (
          <Row
            key={keyForIndex ? keyForIndex(items[i]!, i) : i}
            top={offsets[i]!}
            onMeasured={(h) => handleMeasured(i, h)}
          >
            {renderItem(items[i]!, i)}
          </Row>
        ))}
      </div>
    </div>
  )
}

function Row({ top, onMeasured, children }: { top: number; onMeasured: (h: number) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    onMeasured(el.getBoundingClientRect().height)
  })
  return (
    <div ref={ref} style={{ position: 'absolute', top, left: 0, right: 0 }}>
      {children}
    </div>
  )
}

export default TimelineView
