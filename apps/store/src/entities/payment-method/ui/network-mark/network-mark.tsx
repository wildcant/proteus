import { useLingui } from '@lingui/react/macro'
import { AmericanexpressIcon, type Icon, MastercardIcon, VisaIcon } from '@proteus/icons'
import { cn } from '@proteus/ui-core'
import { NetworkChip } from '#/entities/payment-method/ui/network-chip/network-chip'
import { networkMark } from '#/entities/payment-method/ui/network-mark/network-mark.variants'
import { networkName } from '#/lib/card-networks'

/**
 * Card-network artwork, for the payment rows that name a network.
 *
 * Real badges rather than the nominative text chips (`VISA`, `MC`, `AMEX`) the reference
 * implementation used: a scheme mark is what a shopper scans a payment row for, and they only
 * recognise it in its own colours. The assets already live in `@proteus/icons` — they are the
 * same three the footer strip shows — and like every mark in `payment/` they carry fixed fills,
 * so they do not tint and do not follow the colour scheme. That is the deliberate trade.
 *
 * The badges are 100×60 fitted onto the square icon grid, so `size={40}` renders 40×24.
 */
const NETWORK_MARKS: Record<string, Icon> = {
  visa: VisaIcon,
  mastercard: MastercardIcon,
  amex: AmericanexpressIcon,
}

/**
 * One network, as artwork where we hold it and as a neutral bordered chip where we do not.
 *
 * The fallback is the `+N` chip's treatment rather than a coloured invention, because the
 * `payment/` set's provenance is unrecorded and its licence not yet cleared — see the icons
 * README. Adding more colour badges of unknown origin would widen a gate that is already open.
 */
export function NetworkMark({ brand, className }: { brand: string; className?: string }) {
  const { t } = useLingui()
  const Mark = NETWORK_MARKS[brand]
  const label = networkName(brand)

  if (Mark) {
    return <Mark size={40} title={label} className={cn(networkMark(), 'shrink-0', className)} />
  }

  return <NetworkChip className={className}>{brand === 'unknown' ? t`Card` : label.slice(0, 6)}</NetworkChip>
}
