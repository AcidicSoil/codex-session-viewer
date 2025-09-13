import * as React from 'react'
import type { ResponseItem } from '../types'
import TimelineView from './TimelineView'
import EventCard from './EventCard'
import ChatPair from './ChatPair'
import ErrorBoundary from './ErrorBoundary'
import { usePreferences } from '../state/preferences'

interface ItemWrapper {
  ev: ResponseItem
  key: string
  absIndex: number
}

interface TimelineProps {
  items: readonly ItemWrapper[]
  height?: number
  estimateItemHeight?: number
  scrollToIndex?: number | null
  highlight?: string
  onRevealFile?: (path: string) => void
  onOpenDiff?: (opts: { path: string; diff?: string }) => void
}

type DisplayItem =
  | { kind: 'single'; item: ItemWrapper }
  | { kind: 'pair'; user: ItemWrapper; assistant: ItemWrapper }

export default function Timeline({
  items,
  height = 500,
  estimateItemHeight = 120,
  scrollToIndex,
  highlight,
  onRevealFile,
  onOpenDiff,
}: TimelineProps) {
  const chatMode = usePreferences((s) => s.chatMode)

  const grouped = React.useMemo<DisplayItem[]>(() => {
    if (!chatMode) return items.map((it) => ({ kind: 'single', item: it }))
    const res: DisplayItem[] = []
    for (let i = 0; i < items.length; i++) {
      const cur = items[i]!
      const ev = cur.ev as any
      if (ev.type === 'Message' && ev.role === 'user') {
        const next = items[i + 1]
        if (next) {
          const nextEv = next.ev as any
          if (nextEv.type === 'Message' && nextEv.role === 'assistant') {
            res.push({ kind: 'pair', user: cur, assistant: next })
            i++
            continue
          }
        }
      }
      res.push({ kind: 'single', item: cur })
    }
    return res
  }, [items, chatMode])

  return (
    <TimelineView
      items={grouped}
      height={height}
      estimateItemHeight={estimateItemHeight}
      keyForIndex={(it) =>
        it.kind === 'pair' ? `${it.user.key}-${it.assistant.key}` : it.item.key
      }
      scrollToIndex={scrollToIndex}
      renderItem={(it) => {
        if (it.kind === 'pair') {
          return (
              <div className="mb-2">
                <ChatPair user={it.user.ev as any} assistant={it.assistant.ev as any} />
              </div>
            )
        }
        return (
          <div className="mb-2">
            <ErrorBoundary name="EventCard">
              <EventCard
                item={it.item.ev}
                index={it.item.absIndex}
                bookmarkKey={it.item.key}
                onRevealFile={onRevealFile}
                highlight={highlight}
                onOpenDiff={onOpenDiff}
              />
            </ErrorBoundary>
          </div>
        )
      }}
    />
  )
}

