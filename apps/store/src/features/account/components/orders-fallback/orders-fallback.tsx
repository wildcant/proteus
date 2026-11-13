import { cn } from '@proteus/ui-core'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import {
  ordersFallback,
  ordersFallbackLines,
  ordersFallbackMetaLine,
  ordersFallbackNumberLine,
  ordersFallbackRow,
  ordersFallbackThumbnail,
} from '#/features/account/components/orders-fallback/orders-fallback.variants'

/** The order list while it loads: three placeholder rows. */
export function OrdersFallback() {
  return (
    <ul className={ordersFallback()}>
      {Array.from({ length: 3 }, (_, index) => (
        // A row's place in the list can't be drawn on repeated layers, so the first row's
        // missing rule is written here.
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
        <li key={index} className={cn(ordersFallbackRow(), 'first:border-t-0')}>
          <Skeleton className={cn(ordersFallbackThumbnail(), 'shrink-0')} />
          <div className={ordersFallbackLines()}>
            <Skeleton className={ordersFallbackNumberLine()} />
            <Skeleton className={ordersFallbackMetaLine()} />
          </div>
        </li>
      ))}
    </ul>
  )
}
