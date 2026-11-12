import { Trans } from '@lingui/react/macro'
import { PackageIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ButtonLink } from '#/components/button'
import type { ProductListSearch } from '#/features/products/utils/product-list-search'

/**
 * Replaces the grid rather than following it — an empty result set used to paint an empty grid
 * element above the message.
 *
 * Three branches, because "nothing matched what you typed", "nothing carries the filters you chose"
 * and "there is nothing here" are different facts, and only the first two have anything to clear.
 * Each clear drops its own params and the page but keeps the path and everything else, so a scoped,
 * searched list stays scoped and keeps its search. A scoped list with nothing in it at all
 * links to "Shop all"; the home page is already that.
 */
export function ProductEmpty({ search, isScoped }: { search: ProductListSearch; isScoped: boolean }) {
  const { q, tag, filter } = search

  if (q) {
    return (
      // The header search panel's own phrasing, so the same miss reads the same either way.
      <EmptyMessage message={<Trans>No products match &ldquo;{q}&rdquo;.</Trans>}>
        <ButtonLink to="." search={(previous) => ({ ...previous, q: undefined, offset: undefined })}>
          <Trans>Clear search</Trans>
        </ButtonLink>
      </EmptyMessage>
    )
  }

  if (tag || filter) {
    return (
      <EmptyMessage message={<Trans>No products match the chosen filters.</Trans>}>
        <ButtonLink
          to="."
          search={(previous) => ({ ...previous, tag: undefined, filter: undefined, offset: undefined })}
        >
          <Trans>Clear filters</Trans>
        </ButtonLink>
      </EmptyMessage>
    )
  }

  return (
    <EmptyMessage message={<Trans>No products yet.</Trans>}>
      {isScoped ? (
        <ButtonLink to="/">
          <Trans>Shop all</Trans>
        </ButtonLink>
      ) : null}
    </EmptyMessage>
  )
}

function EmptyMessage({ message, children }: { message: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <PackageIcon className="size-8 text-ink-subtle" strokeWidth={1.5} />
      <p className="mt-6 max-w-70 text-ink-muted text-sm">{message}</p>
      {children ? <div className="mt-8">{children}</div> : null}
    </div>
  )
}
