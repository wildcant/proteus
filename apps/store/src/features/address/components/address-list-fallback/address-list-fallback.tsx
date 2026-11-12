import { cn } from '@proteus/ui-core'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import {
  addressListFallback,
  addressListFallbackCard,
} from '#/features/address/components/address-list-fallback/address-list-fallback.variants'

/** Two card-sized placeholders while the address list loads. */
export function AddressListFallback({ className }: { className?: string }) {
  return (
    <div className={cn(addressListFallback(), className)} aria-hidden="true">
      <Skeleton className={addressListFallbackCard()} />
      <Skeleton className={addressListFallbackCard()} />
    </div>
  )
}
