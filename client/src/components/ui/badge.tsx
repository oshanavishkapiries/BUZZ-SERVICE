import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider rounded-[var(--radius)] transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-[var(--accent-muted)] text-[var(--accent)]',
        secondary:   'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
        success:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        destructive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        warning:     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        info:        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        outline:     'border border-[var(--border-color)] text-[var(--text-secondary)]',
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
