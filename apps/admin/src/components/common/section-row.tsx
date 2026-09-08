import { cn } from '@proteus/ui'
import type { ReactNode } from 'react'

type SectionRowProps = {
  title: string
  /** What the field decides, for a title whose name does not say it. Sits under the title. */
  description?: string
  value?: ReactNode | string | null
  actions?: ReactNode
}

export function SectionRow({ title, description, value, actions }: SectionRowProps) {
  const isValueString = typeof value === 'string' || !value

  return (
    <div
      data-slot="section-row"
      className={cn('grid w-full grid-cols-2 gap-4 px-6 py-4 text-muted-foreground text-sm', {
        'grid-cols-[1fr_1fr_28px]': !!actions,
        // A described row is two lines tall on the left and one on the right, so the value hangs
        // level with the title rather than floating beside the pair.
        'items-start': !!description,
        'items-center': !description,
      })}
    >
      <span className="flex flex-col gap-y-1">
        <span className="font-medium">{title}</span>
        {!!description && <span className="text-pretty text-xs opacity-70">{description}</span>}
      </span>

      {isValueString ? (
        <span className="whitespace-pre-line text-pretty">{value ?? '-'}</span>
      ) : (
        <div className="flex min-w-0 flex-wrap gap-1">{value}</div>
      )}

      {!!actions && <div>{actions}</div>}
    </div>
  )
}
