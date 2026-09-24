import { Trans } from '@lingui/react/macro'
import { PackageIcon } from 'lucide-react'
import { ButtonLink } from '#/components/button'

/**
 * What the detail route shows when it has no product to show: the route's `errorComponent` when the
 * read failed, and `ProductDetail`'s own answer to a 404.
 *
 * The copy does not guess why. A product the store never had, one this market cannot price and one
 * whose read fell over all read the same — the middle one is the ordinary case now that a market
 * decides the catalogue, and the bag notice above says so by name when that is what happened.
 *
 * The way out is the catalogue, because it is the one page that is certainly there: whatever the
 * shopper is standing in, it has products it can sell them.
 */
export function ProductError() {
  return (
    <main className="mx-auto flex w-full max-w-350 flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <PackageIcon className="size-8 text-ink-subtle" strokeWidth={1.5} />
      <h1 className="type-title mt-6 text-ink">
        <Trans>We couldn't show this product</Trans>
      </h1>
      <p className="mt-4 max-w-70 text-ink-muted text-sm">
        <Trans>It may not be one we sell here.</Trans>
      </p>
      <ButtonLink to="/" className="mt-8">
        <Trans>Browse products</Trans>
      </ButtonLink>
    </main>
  )
}
