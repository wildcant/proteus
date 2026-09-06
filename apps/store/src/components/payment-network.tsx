import { AmericanexpressIcon, type Icon, MastercardIcon, VisaIcon } from '@proteus/icons'
import { cn } from '@proteus/ui'
import { ACCEPTED_CARD_NETWORKS, networkName } from '#/lib/card-networks'

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

/** How many marks a row shows before the rest collapse into the overflow chip. */
const MARKS_SHOWN = 3

/**
 * One network, as artwork where we hold it and as a neutral bordered chip where we do not.
 *
 * The fallback is the `+N` chip's treatment rather than a coloured invention, because the
 * `payment/` set's provenance is unrecorded and its licence not yet cleared — see the icons
 * README. Adding more colour badges of unknown origin would widen a gate that is already open.
 */
export function NetworkMark({ brand, className }: { brand: string; className?: string }) {
  const Mark = NETWORK_MARKS[brand]
  const label = networkName(brand)

  if (Mark) {
    return <Mark size={40} title={label} className={cn('h-6 w-10 shrink-0', className)} />
  }

  return <NetworkChip className={className}>{brand === 'unknown' ? 'Card' : label.slice(0, 6)}</NetworkChip>
}

/**
 * The accepted-network strip, right-aligned on a row.
 *
 * Marks up to the cap, then a bordered neutral `+N` for the rest — the reference's own treatment,
 * and the reason `ACCEPTED_CARD_NETWORKS` is not trimmed to what we have artwork for. Announced
 * as one image with one label, because a screen reader reading out seven scheme names in the
 * middle of a payment choice is noise rather than information.
 */
export function AcceptedNetworks({ brands = ACCEPTED_CARD_NETWORKS }: { brands?: readonly string[] }) {
  const shown = brands.slice(0, MARKS_SHOWN)
  const overflow = brands.length - shown.length

  return (
    <span
      role="img"
      aria-label={`${brands.length} card networks accepted`}
      className="flex shrink-0 items-center gap-1"
    >
      {shown.map((brand) => (
        <NetworkMark key={brand} brand={brand} />
      ))}
      {overflow > 0 && <NetworkChip>{`+${overflow}`}</NetworkChip>}
    </span>
  )
}

/** The neutral box the overflow count and every unillustrated network share. */
function NetworkChip({ children, className }: { children: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-6 w-10 shrink-0 items-center justify-center border border-line bg-surface text-[10px] text-ink-muted leading-none',
        className,
      )}
    >
      {children}
    </span>
  )
}
