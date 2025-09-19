import * as React from 'react'

export interface ResizeObserverSize {
  width: number
  height: number
}

export interface UseResizeObserverOptions {
  /**
   * Debounce duration in milliseconds before applying a resize update.
   * Defaults to 120ms to avoid thrashing layout-sensitive components.
   */
  debounceMs?: number
  /**
   * Optional ResizeObserver box option.
   */
  box?: ResizeObserverBoxOptions
  /**
   * Whether the observer should be disabled.
   */
  disabled?: boolean
  /**
   * Callback invoked after size state updates.
   */
  onResize?: (size: ResizeObserverSize, entry: ResizeObserverEntry) => void
}

const defaultSize: ResizeObserverSize = { width: 0, height: 0 }

/**
 * useResizeObserver wraps the native ResizeObserver API with sane defaults,
 * debounce, SSR-safety and React state integration. It returns the latest
 * content-box dimensions and invokes the optional `onResize` callback after
 * the state update completes.
 */
export function useResizeObserver<T extends Element>(
  ref: React.RefObject<T>,
  options?: UseResizeObserverOptions
): ResizeObserverSize {
  const { debounceMs = 120, box = 'content-box', disabled = false, onResize } = options || {}
  const [size, setSize] = React.useState<ResizeObserverSize>(defaultSize)
  const latestOnResize = useLatest(onResize)

  React.useEffect(() => {
    const node = ref.current
    if (!node || typeof window === 'undefined' || typeof ResizeObserver === 'undefined' || disabled) {
      return
    }

    let frame: number | null = null
    let timeout: ReturnType<typeof setTimeout> | null = null

    const applySize = (entry: ResizeObserverEntry) => {
      const boxSize = Array.isArray(entry.contentBoxSize) ? entry.contentBoxSize[0] : (entry.contentBoxSize as any)
      const nextWidth = boxSize?.inlineSize ?? entry.contentRect.width
      const nextHeight = boxSize?.blockSize ?? entry.contentRect.height

      setSize((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) {
          return prev
        }
        const next = { width: nextWidth, height: nextHeight }
        const notify = () => latestOnResize.current?.(next, entry)
        if (typeof queueMicrotask === 'function') {
          queueMicrotask(notify)
        } else {
          setTimeout(notify, 0)
        }
        return next
      })
    }

    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return
      const entry = entries[entries.length - 1]!
      const run = () => {
        frame = null
        applySize(entry)
      }
      if (debounceMs > 0) {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => {
          frame = window.requestAnimationFrame(run)
        }, debounceMs)
      } else {
        frame = window.requestAnimationFrame(run)
      }
    })

    observer.observe(node, { box })

    return () => {
      observer.disconnect()
      if (frame != null) {
        window.cancelAnimationFrame(frame)
      }
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [ref, debounceMs, box, disabled, latestOnResize])

  return size
}

function useLatest<T>(value: T) {
  const ref = React.useRef(value)
  React.useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

export default useResizeObserver
