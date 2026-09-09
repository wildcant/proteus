import { Button } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { PackageIcon } from 'lucide-react'

/**
 * What the detail route renders when the product it was asked for cannot be read.
 *
 * The copy does not guess why. A product the store never had and one this market cannot price
 * arrive here as the same not-found — the second is the ordinary case now that a market decides
 * the catalogue, and the bag notice above says so by name when that is what happened.
 *
 * The way out is the catalogue, because it is the one page that is certainly there: whatever the
 * shopper is standing in, it has products it can sell them.
 */
export function ProductError() {
  return (
    <main className="mx-auto flex w-full max-w-350 flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <PackageIcon className="size-8 text-ink-subtle" strokeWidth={1.5} />
      <h1 className="type-title mt-6 text-ink">We couldn't show this product</h1>
      <p className="mt-4 max-w-70 text-ink-muted text-sm">It may not be one we sell here.</p>
      <Button render={<Link to="/" />} className="mt-8">
        Browse products
      </Button>
    </main>
  )
}
