import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import { Fragment } from 'react'
import type { StoreProductCategoryTreeNode } from '#/api/generated/model'
import {
  categoryBreadcrumb,
  categoryBreadcrumbChevron,
  categoryBreadcrumbLink,
  categoryBreadcrumbSeparator,
} from '#/features/products/components/category-breadcrumb/category-breadcrumb.variants'
import type { LinkTarget } from '#/lib/link-target'

/**
 * The way back up from a category page: "Shop all", then each ancestor, root first. The Category
 * itself is left off — it is the heading directly below.
 */
export function CategoryBreadcrumb({
  ancestors,
  allProductsLink,
  categoryLink,
}: {
  ancestors: StoreProductCategoryTreeNode[]
  /** ALL_PRODUCTS. */
  allProductsLink: LinkTarget
  /** CATEGORY: an ancestor's page. */
  categoryLink: (handle: string) => LinkTarget
}) {
  const { t } = useLingui()

  return (
    <nav aria-label={t`Breadcrumb`}>
      <ol className={cn(categoryBreadcrumb(), 'm-0 list-none p-0')}>
        <li className="flex">
          <Link {...allProductsLink} className={categoryBreadcrumbLink()}>
            <Trans>Shop all</Trans>
          </Link>
        </li>
        {ancestors.map((ancestor) => (
          <Fragment key={ancestor.id}>
            <li aria-hidden className={cn(categoryBreadcrumbChevron(), 'flex')}>
              <ChevronRightIcon className={categoryBreadcrumbSeparator()} />
            </li>
            <li className="flex">
              <Link {...categoryLink(ancestor.handle)} className={categoryBreadcrumbLink()}>
                {ancestor.name}
              </Link>
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
