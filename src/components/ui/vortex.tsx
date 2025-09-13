import * as React from 'react'
import { cn } from '../../utils/cn'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export interface VortexProps {
  items: string[]
  className?: string
}

export function Vortex({ items, className }: VortexProps) {
  const reduce = usePrefersReducedMotion()
  return (
    <ul className={cn('text-sm', reduce ? '' : 'animate-pulse', className)} data-animate={reduce ? 'false' : 'true'}>
      {items.map((file) => (
        <li key={file}>{file}</li>
      ))}
    </ul>
  )
}

export default Vortex
