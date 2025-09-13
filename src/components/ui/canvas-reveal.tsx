import * as React from 'react'
import { cn } from '../../utils/cn'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export interface CanvasRevealProps {
  children: React.ReactNode
  className?: string
}

export function CanvasReveal({ children, className }: CanvasRevealProps) {
  const reduce = usePrefersReducedMotion()
  return (
    <div className={cn('relative overflow-hidden', className)} data-animate={reduce ? 'false' : 'true'}>
      {!reduce && <canvas className="absolute inset-0 w-full h-full opacity-40 animate-pulse" />}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

export default CanvasReveal
