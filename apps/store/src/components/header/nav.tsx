import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import type { StoreProductCategoryTreeNode } from '#/api/generated/model'
import { useSuspenseCategoryTree } from '#/api/product-categories'
import { Popover, PopoverContent, PopoverTrigger } from '#/components/popover'

const railItemClassName = 'font-medium text-ink text-sm no-underline hover:text-ink-muted'

/**
 * The storefront's primary navigation, and the only part of the header that is navigation
 * in the landmark sense — which is why the `<nav>` element lives here rather than around
 * the whole bar. The wordmark, search, account and bag are the header's other business.
 *
 * "Shop all", then one entry per top-level Visible Category, straight from the tree: no category
 * is named in code, so the same rail serves any shop — and one with no Categories still has a way
 * to the catalogue.
 *
 * Desktop only. Below `lg` the side menu carries these same destinations, so a rail that
 * merely collapsed would be the same links twice.
 */
type NavProps = {
  className?: string
}

export function Nav({ className }: NavProps) {
  const categories = useSuspenseCategoryTree()

  return (
    <nav className={cn('hidden lg:block', className)}>
      <ul className="m-0 flex list-none items-center gap-8 p-0">
        <li>
          <Link to="/" className={railItemClassName}>
            <Trans>Shop all</Trans>
          </Link>
        </li>
        {categories.map((category) => (
          <li key={category.id}>
            {category.children.length > 0 ? (
              <RailPanel category={category} />
            ) : (
              <Link to="/categories/$handle" params={{ handle: category.handle }} className={railItemClassName}>
                {category.name}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * A Category with children opens a panel rather than navigating: its children in rank order, led
 * by "Shop all" for the Category itself, since the trigger no longer goes there. Controlled so that
 * following a link closes it — a navigation leaves a popover open otherwise.
 */
function RailPanel({ category }: { category: StoreProductCategoryTreeNode }) {
  const [open, setOpen] = useState(false)
  const { name } = category
  const close = () => setOpen(false)
  const panelLinkClassName = 'block px-4 py-2 text-ink text-sm no-underline hover:bg-surface-subtle'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn('flex cursor-pointer items-center gap-1', railItemClassName)}>
        {category.name}
        <ChevronDownIcon className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="min-w-56 py-2">
        <ul className="m-0 list-none p-0">
          <li>
            <Link
              to="/categories/$handle"
              params={{ handle: category.handle }}
              onClick={close}
              className={cn(panelLinkClassName, 'font-medium')}
            >
              <Trans>Shop all {name}</Trans>
            </Link>
          </li>
          {category.children.map((child) => (
            <li key={child.id}>
              <Link
                to="/categories/$handle"
                params={{ handle: child.handle }}
                onClick={close}
                className={panelLinkClassName}
              >
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
