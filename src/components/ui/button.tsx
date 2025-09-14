import * as React from 'react'
import { cn } from '../../utils/cn'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
type Size = 'default' | 'sm' | 'lg' | 'icon'

const base =
  'inline-flex items-center justify-center gap-x-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50'

const variants: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  secondary: 'bg-background text-foreground hover:bg-background/80',
  destructive: 'bg-red-600 text-white hover:bg-red-500',
  outline: 'border border-foreground/20 bg-background text-foreground hover:bg-background/80',
  ghost: 'bg-transparent hover:bg-background/80 text-foreground',
  link: 'bg-transparent text-primary underline-offset-4 hover:underline'
}

const sizes: Record<Size, string> = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 rounded-md px-3 text-xs',
  lg: 'h-10 rounded-md px-6',
  icon: 'h-9 w-9 p-0'
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export default Button
