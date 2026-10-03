import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'
const buttonVariants = cva(
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-text-inverse hover:opacity-90',
        outline: 'border border-text-primary bg-transparent text-text-primary hover:bg-text-primary hover:text-bg-surface',
        ghost: 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
      },
      size: { default: 'px-5 py-2.5', icon: 'size-11' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, asChild, type = 'button', ...props }, ref) {
  const Component = asChild ? Slot.Root : 'button'
  return <Component ref={ref} type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
