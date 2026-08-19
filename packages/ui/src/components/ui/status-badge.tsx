import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'

import { cn } from '#/lib/utils.ts'

const dotVariants = cva('size-2', {
  variants: {
    color: {
      grey: 'bg-neutral-400 dark:bg-neutral-500',
      green: 'bg-green-500 dark:bg-green-400',
      red: 'bg-red-500 dark:bg-red-400',
      blue: 'bg-blue-500 dark:bg-blue-400',
      orange: 'bg-orange-500 dark:bg-orange-400',
      purple: 'bg-purple-500 dark:bg-purple-400',
    },
  },
  defaultVariants: {
    color: 'grey',
  },
})

type StatusBadgeProps = Omit<React.ComponentPropsWithoutRef<'span'>, 'color'> & VariantProps<typeof dotVariants>

const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ children, className, color = 'grey', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex w-fit select-none items-center overflow-hidden rounded-md border border-border bg-secondary pl-0 pr-1 text-xs font-medium leading-none text-secondary-foreground',
          className,
        )}
        {...props}
      >
        <div role="presentation" className="flex size-5 items-center justify-center">
          <div className={dotVariants({ color })} />
        </div>
        <span className="capitalize">{children}</span>
      </span>
    )
  },
)
StatusBadge.displayName = 'StatusBadge'

export { dotVariants as statusBadgeDotVariants, StatusBadge }
