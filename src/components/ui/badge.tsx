import * as React from 'react'
import { cn } from '../../utils/cn'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline'

const base = 'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium'

const variants: Record<Variant, string> = {
  default: 'border-transparent bg-gray-800 text-white',
  secondary: 'border-gray-300 text-gray-700',
  destructive: 'border-transparent bg-red-600 text-white',
  outline: 'border-gray-300 text-gray-700'
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return <div className={cn(base, variants[variant], className)} {...props} />
}

export default Badge
