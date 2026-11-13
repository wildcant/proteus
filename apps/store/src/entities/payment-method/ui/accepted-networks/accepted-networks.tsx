import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import {
  acceptedNetworks,
  acceptedNetworksMark,
  acceptedNetworksOverflow,
} from '#/entities/payment-method/ui/accepted-networks/accepted-networks.variants'
import { NetworkChip } from '#/entities/payment-method/ui/network-chip/network-chip'
import { NetworkMark } from '#/entities/payment-method/ui/network-mark/network-mark'
import { ACCEPTED_CARD_NETWORKS } from '#/lib/card-networks'

/** How many marks a row shows before the rest collapse into the overflow chip. */
const MARKS_SHOWN = 3

/**
 * The accepted-network strip, right-aligned on a row.
 *
 * Marks up to the cap, then a bordered neutral `+N` for the rest — the reference's own treatment,
 * and the reason `ACCEPTED_CARD_NETWORKS` is not trimmed to what we have artwork for. Announced
 * as one image with one label, because a screen reader reading out seven scheme names in the
 * middle of a payment choice is noise rather than information.
 */
export function AcceptedNetworks({
  brands = ACCEPTED_CARD_NETWORKS,
  className,
}: {
  brands?: readonly string[]
  className?: string
}) {
  const { t } = useLingui()
  const shown = brands.slice(0, MARKS_SHOWN)
  const count = brands.length
  const overflow = brands.length - shown.length

  return (
    <span
      role="img"
      aria-label={t`${count} card networks accepted`}
      className={cn(acceptedNetworks(), 'shrink-0', className)}
    >
      {shown.map((brand) => (
        <NetworkMark key={brand} brand={brand} className={acceptedNetworksMark()} />
      ))}
      {overflow > 0 && <NetworkChip className={acceptedNetworksOverflow()}>{`+${overflow}`}</NetworkChip>}
    </span>
  )
}
