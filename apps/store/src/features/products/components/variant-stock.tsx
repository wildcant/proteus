import { Plural, Trans } from '@lingui/react/macro'
import type { StoreVariantStock } from '#/api/generated/model'

/**
 * What the shopper is told about the selected variant's stock.
 *
 * A render of the union and nothing else, per ADR-0015: the threshold that decided `low` and the
 * subtraction behind `remaining` are the backend's, so there is no number to compare here and
 * nothing to derive. Untracked and backorder variants never reach this component as anything but
 * `available`, which is why it has no case for either.
 *
 * `available` draws nothing. "In stock" under every price is a line the shopper learns to read
 * past, and the attention it costs is exactly what the other two branches are rendered for.
 */
export function VariantStock({ stock }: { stock: StoreVariantStock }) {
  if (stock.state === 'available') return null

  // Sold out is stated here as well as on the button, and they are not the same message twice:
  // below `lg` the button is pinned to the viewport while this sits with the price, so a shopper
  // reading the garment finds out here and a shopper reaching for the button finds out there.
  if (stock.state === 'soldOut')
    return (
      <p className="mt-2 text-ink-muted">
        <Trans>Sold out</Trans>
      </p>
    )

  // `text-sale` rather than the muted treatment above: this one is an invitation to decide now,
  // not a refusal, and it is the same red the account's expiring-card label uses for the other
  // thing a shopper is running out of time on.
  const { remaining } = stock
  return (
    <p className="mt-2 text-sale">
      <Plural value={remaining} one="Only # left" other="Only # left" />
    </p>
  )
}
