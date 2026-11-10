import { Trans } from '@lingui/react/macro'
import { PackageIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ButtonLink } from '#/components/button'

/**
 * What a scoped list page — a category, a collection — shows when its handle names nothing the
 * store shows: one it never had, one the merchant hid, or one whose ancestor is hidden. Modelled on
 * `ProductError`, inside the store's header and footer, and like it the copy does not guess which.
 *
 * Each page brings its own words; the way out is the same, the whole catalogue.
 */
export function ProductListNotFound({ heading, body }: { heading: ReactNode; body: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-350 flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8">
      <PackageIcon className="size-8 text-ink-subtle" strokeWidth={1.5} />
      <h1 className="type-title mt-6 text-ink">{heading}</h1>
      <p className="mt-4 max-w-70 text-ink-muted text-sm">{body}</p>
      <ButtonLink to="/" className="mt-8">
        <Trans>Shop all</Trans>
      </ButtonLink>
    </main>
  )
}
