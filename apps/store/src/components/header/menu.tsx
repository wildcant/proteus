import { useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { StoreProductCategoryTreeNode } from '#/api/generated/model'

/** One destination: the catalogue when `handle` is absent, otherwise that Category's page. */
type MenuDestination = { key: string; label: string; handle?: string }

/**
 * A top-level Category with children. It opens rather than navigates, so its own page is the first
 * of `links`, as "Shop all <name>".
 */
export type MenuGroup = { key: string; label: string; links: MenuDestination[] }

type MenuEntry = MenuDestination | MenuGroup

export const isMenuGroup = (entry: MenuEntry): entry is MenuGroup => 'links' in entry

/**
 * The storefront's navigation as data, which the header rail and the side menu each render in
 * their own shape: "Shop all", then one entry per top-level Visible Category, straight from the
 * tree. No category is named in code, so the same menu serves any shop — and one with no
 * Categories still has a way to the catalogue.
 */
export function useMenuEntries(categories: StoreProductCategoryTreeNode[]): MenuEntry[] {
  const { t } = useLingui()

  return [
    { key: 'shop-all', label: t`Shop all` },
    ...categories.map(({ id, name, handle, children }): MenuEntry => {
      if (children.length === 0) return { key: id, label: name, handle }
      return {
        key: id,
        label: name,
        links: [
          { key: id, label: t`Shop all ${name}`, handle },
          ...children.map((child) => ({ key: child.id, label: child.name, handle: child.handle })),
        ],
      }
    }),
  ]
}

/** The link for one destination; `children` defaults to its label, for a row that adds an icon. */
export function MenuLink({
  destination,
  className,
  onClick,
  children,
}: {
  destination: MenuDestination
  className?: string
  onClick?: () => void
  children?: ReactNode
}) {
  const content = children ?? destination.label
  if (!destination.handle) {
    return (
      <Link to="/" onClick={onClick} className={className}>
        {content}
      </Link>
    )
  }
  return (
    <Link to="/categories/$handle" params={{ handle: destination.handle }} onClick={onClick} className={className}>
      {content}
    </Link>
  )
}
