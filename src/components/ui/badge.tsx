import * as React from 'react'
import { cn } from '../../utils/cn'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline'

const base = 'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium'

const variants: Record<Variant, string> = {
  // Active chip: filled accent (primary)
  default: 'border-transparent bg-primary text-primary-foreground',
  // Neutral chip: subtle border only
  secondary: 'border-gray-600 text-gray-200',
  destructive: 'border-transparent bg-red-600 text-white',
  outline: 'border-primary text-primary'
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return <div className={cn(base, variants[variant], className)} {...props} />
}

export default Badge
