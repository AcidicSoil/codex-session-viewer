import * as React from 'react'
import { cn } from '../../utils/cn'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
type Size = 'default' | 'sm' | 'lg' | 'icon'

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:pointer-events-none disabled:opacity-50'

const variants: Record<Variant, string> = {
  default: 'bg-teal-600 text-white hover:bg-teal-500',
  secondary: 'bg-gray-700 text-gray-100 hover:bg-gray-600',
  destructive: 'bg-red-600 text-white hover:bg-red-500',
  outline: 'border border-gray-600 bg-transparent hover:bg-gray-800 text-gray-100',
  ghost: 'bg-transparent hover:bg-gray-800 text-gray-100',
  link: 'bg-transparent text-teal-400 underline-offset-4 hover:underline'
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
