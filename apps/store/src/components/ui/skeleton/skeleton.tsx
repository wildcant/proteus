import { cn } from '@proteus/ui-core'
import type * as React from 'react'
import { skeleton } from '#/components/ui/skeleton/skeleton.variants'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" className={cn(skeleton(), 'animate-pulse', className)} {...props} />
}

export { Skeleton }
