import * as React from 'react'
import { cn } from '../../utils/cn'

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  viewportClassName?: string
}

export function ScrollArea({ className, viewportClassName, children, ...props }: ScrollAreaProps) {
  return (
    <div className={cn('relative overflow-hidden', className)} {...props}>
      <div className={cn('h-full w-full overflow-auto', viewportClassName)}>{children}</div>
    </div>
  )
}

export default ScrollArea

