import { cn } from '@proteus/ui'
import type { PropsWithChildren } from 'react'

type StatusColor = 'green' | 'red' | 'blue' | 'orange' | 'grey' | 'purple'

type StatusCellProps = PropsWithChildren<{
  color?: StatusColor
}>

const dotColors: Record<StatusColor, string> = {
  grey: 'bg-neutral-400 dark:bg-neutral-500',
  green: 'bg-green-500 dark:bg-green-400',
  red: 'bg-red-500 dark:bg-red-400',
  blue: 'bg-blue-500 dark:bg-blue-400',
  orange: 'bg-orange-500 dark:bg-orange-400',
  purple: 'bg-purple-500 dark:bg-purple-400',
}

export function StatusCell({ color = 'grey', children }: StatusCellProps) {
  return (
    <div className="flex h-full w-full items-center gap-x-2 overflow-hidden text-sm text-muted-foreground">
      <div role="presentation" className="flex size-5 shrink-0 items-center justify-center">
        <div className={cn('size-2 shadow-[0px_0px_0px_1px_rgba(0,0,0,0.12)_inset]', dotColors[color])} />
      </div>
      <span className="truncate capitalize">{children}</span>
    </div>
  )
}
