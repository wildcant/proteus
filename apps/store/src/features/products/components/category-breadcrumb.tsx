import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import { Fragment } from 'react'
import type { StoreProductCategoryTreeNode } from '#/api/generated/model'

/**
 * The way back up from a category page: "Shop all", then each ancestor, root first. The Category
 * itself is left off — it is the heading directly below.
 */
export function CategoryBreadcrumb({ ancestors }: { ancestors: StoreProductCategoryTreeNode[] }) {
  const { t } = useLingui()
  const linkClassName = 'text-ink-muted no-underline hover:text-ink'

  return (
    <nav aria-label={t`Breadcrumb`}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-sm">
        <li>
          <Link to="/" className={linkClassName}>
            <Trans>Shop all</Trans>
          </Link>
        </li>
        {ancestors.map((ancestor) => (
          <Fragment key={ancestor.id}>
            <li aria-hidden className="flex text-ink-subtle">
              <ChevronRightIcon className="size-3.5" />
            </li>
            <li>
              <Link to="/categories/$handle" params={{ handle: ancestor.handle }} className={linkClassName}>
                {ancestor.name}
              </Link>
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
