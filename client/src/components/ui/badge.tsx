import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 px-2 py-0.5 text-[0.72rem] font-semibold uppercase tracking-wide rounded-[var(--radius)] transition-colors leading-none',
  {
    variants: {
      variant: {
        // All semantic variants use CSS classes from globals.css — no Tailwind color classes
        // that would be missed by the scanner in ternary expressions
        default:     'badge badge-orange',
        secondary:   'border border-[var(--border-color)] text-[var(--text-primary)] bg-transparent',
        success:     'badge badge-green',
        destructive: 'badge badge-red',
        warning:     'badge badge-orange',
        info:        'badge badge-blue',
        outline:     'border border-[var(--border-color)] text-[var(--text-primary)] bg-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
