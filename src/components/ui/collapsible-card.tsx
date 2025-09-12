import * as React from 'react'
import { Collapsible } from './collapsible'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { cn } from '../../utils/cn'

export interface CollapsibleCardProps {
  title: React.ReactNode
  defaultOpen?: boolean
  headerRight?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function CollapsibleCard({ title, defaultOpen = true, headerRight, children, className }: CollapsibleCardProps) {
  return (
    <Card className={className}>
      <Collapsible.Root defaultOpen={defaultOpen}>
        <CardHeader className="flex flex-row items-center justify-between">
          <Collapsible.Trigger className={cn('group inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1 -mx-1')}>
            <Chevron className="h-4 w-4 text-gray-400 transition-transform group-aria-expanded:rotate-90" />
            <CardTitle className="select-none">{title}</CardTitle>
          </Collapsible.Trigger>
          {headerRight && (
            <div className="ml-2">{headerRight}</div>
          )}
        </CardHeader>
        <Collapsible.Content>
          <CardContent>{children}</CardContent>
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  )
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default CollapsibleCard
