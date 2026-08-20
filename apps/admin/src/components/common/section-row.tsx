import { cn } from '@proteus/ui'
import type { ReactNode } from 'react'

type SectionRowProps = {
  title: string
  value?: ReactNode | string | null
  actions?: ReactNode
}

export function SectionRow({ title, value, actions }: SectionRowProps) {
  const isValueString = typeof value === 'string' || !value

  return (
    <div
      className={cn('grid w-full grid-cols-2 items-center gap-4 px-6 py-4 text-muted-foreground text-sm', {
        'grid-cols-[1fr_1fr_28px]': !!actions,
      })}
    >
      <span className="font-medium">{title}</span>

      {isValueString ? (
        <span className="whitespace-pre-line text-pretty">{value ?? '-'}</span>
      ) : (
        <div className="flex min-w-0 flex-wrap gap-1">{value}</div>
      )}

      {!!actions && <div>{actions}</div>}
    </div>
  )
}
