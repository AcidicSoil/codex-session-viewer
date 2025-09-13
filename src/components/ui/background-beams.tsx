import * as React from 'react'
import { cn } from '../../utils/cn'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export interface BackgroundBeamsProps {
  children: React.ReactNode
  className?: string
}

export function BackgroundBeams({ children, className }: BackgroundBeamsProps) {
  const reduce = usePrefersReducedMotion()
  return (
    <div className={cn('relative', className)} data-animate={reduce ? 'false' : 'true'}>
      {!reduce && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-teal-200/40 to-transparent animate-pulse" />
      )}
      {children}
    </div>
  )
}

export default BackgroundBeams
