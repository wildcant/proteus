import { cn } from '@proteus/ui-core'
import { networkChip, networkChipLabel } from '#/entities/payment-method/ui/network-chip/network-chip.variants'

/** The neutral box the overflow count and every unillustrated network share. */
export function NetworkChip({ children, className }: { children: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn(networkChip(), 'shrink-0', className)}>
      <span className={networkChipLabel()}>{children}</span>
    </span>
  )
}
