import * as React from 'react'
import { cn } from '../../utils/cn'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export interface SparklesProps {
  children: React.ReactNode
  className?: string
}

export function Sparkles({ children, className }: SparklesProps) {
  const reduce = usePrefersReducedMotion()
  if (reduce) return <span className={cn(className)} data-animate="false">{children}</span>
  return (
    <span className={cn('relative inline-block', className)} data-animate="true">
      <span className="pointer-events-none absolute inset-0 animate-ping opacity-20">✦</span>
      {children}
    </span>
  )
}

export default Sparkles
