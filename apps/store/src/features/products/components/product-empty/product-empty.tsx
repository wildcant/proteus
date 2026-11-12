import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { PackageIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ButtonLink } from '#/components/ui/button/button'
import {
  productEmpty,
  productEmptyAction,
  productEmptyBody,
  productEmptyIcon,
  productEmptyMessage,
  productEmptyPackage,
} from '#/features/products/components/product-empty/product-empty.variants'
import type { ProductListSearch } from '#/features/products/utils/product-list-search'
import type { LinkTarget } from '#/lib/link-target'

type ProductEmptyProps = {
  search: ProductListSearch
  /** SHOP_ALL, on a scoped list only: the home page is already all of it. */
  shopAllLink?: LinkTarget
  className?: string
}

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
export function ProductEmpty({ search, shopAllLink, className }: ProductEmptyProps) {
  const { q, tag, filter, minPrice, maxPrice } = search

  if (q) {
    return (
      // The header search panel's own phrasing, so the same miss reads the same either way.
      <EmptyMessage className={className} message={<Trans>No products match &ldquo;{q}&rdquo;.</Trans>}>
        <ButtonLink to="." search={(previous) => ({ ...previous, q: undefined, offset: undefined })}>
          <Trans>Clear search</Trans>
        </ButtonLink>
      </EmptyMessage>
    )
  }

  if (tag || filter || minPrice !== undefined || maxPrice !== undefined) {
    return (
      <EmptyMessage className={className} message={<Trans>No products match the chosen filters.</Trans>}>
        <ButtonLink
          to="."
          search={(previous) => ({
            ...previous,
            tag: undefined,
            filter: undefined,
            minPrice: undefined,
            maxPrice: undefined,
            offset: undefined,
          })}
        >
          <Trans>Clear filters</Trans>
        </ButtonLink>
      </EmptyMessage>
    )
  }

  return (
    <EmptyMessage className={className} message={<Trans>No products yet.</Trans>}>
      {shopAllLink ? (
        <ButtonLink {...shopAllLink}>
          <Trans>Shop all</Trans>
        </ButtonLink>
      ) : null}
    </EmptyMessage>
  )
}

function EmptyMessage({
  message,
  className,
  children,
}: {
  message: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn(productEmpty(), className)}>
      <PackageIcon className={cn(productEmptyIcon(), productEmptyPackage())} strokeWidth={1.5} />
      <div className={productEmptyBody()}>
        <p className={productEmptyMessage()}>{message}</p>
        {children ? <div className={productEmptyAction()}>{children}</div> : null}
      </div>
    </div>
  )
}
