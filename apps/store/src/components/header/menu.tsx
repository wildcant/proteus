import { useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { type MenuSection, type MenuSource, type MenuTarget, resolveMenuItems } from '#/components/header/menu-items'

/** One destination: the catalogue when `target` is absent, otherwise that Category's or Collection's page. */
type MenuDestination = { key: string; label: string; target?: MenuTarget }

/**
 * A menu entry that opens rather than navigates. A Category with children lists them in `links`
 * under `shopAll`, "Shop all <name>". An entry with sections lays them out as titled columns in
 * `sections` instead, with `footer` set apart below, and has neither `links` nor `shopAll`: its
 * columns say where "View all" goes.
 */
export type MenuGroup = {
  key: string
  label: string
  shopAll: MenuDestination | null
  links: MenuDestination[]
  sections: MenuSection[]
  footer: MenuDestination[]
}

type MenuEntry = MenuDestination | MenuGroup

export const isMenuGroup = (entry: MenuEntry): entry is MenuGroup => 'shopAll' in entry

/**
 * The storefront's navigation as data, which the header rail and the side menu each render in
 * their own shape: "Shop all", then the store's menu (see `resolveMenuItems`). No grouping is
 * named in code, so the same menu serves any shop — and one with nothing on its menu still has a
 * way to the catalogue.
 */
export function useMenuEntries(source: MenuSource): MenuEntry[] {
  const { t } = useLingui()

  return [
    { key: 'shop-all', label: t`Shop all` },
    ...resolveMenuItems(source).map(({ key, label: name, target, children, sections, footer }): MenuEntry => {
      if (children.length === 0 && sections.length === 0) return { key, label: name, target }
      const shopAll = sections.length > 0 ? null : { key, label: t`Shop all ${name}`, target }
      return { key, label: name, shopAll, links: children, sections, footer }
    }),
  ]
}

/** "View all", or "View all Adidas" when the column is narrower than the entry. */
export function useViewAllLabel() {
  const { t } = useLingui()
  return (name: string | null) => (name ? t`View all ${name}` : t`View all`)
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
  const { target } = destination
  if (!target) {
    return (
      <Link to="/" onClick={onClick} className={className}>
        {content}
      </Link>
    )
  }
  // A sections link lands on the list already filtered, through the list's own `filter` param.
  const search = target.filter ? { filter: target.filter } : undefined
  if (target.type === 'collection') {
    return (
      <Link
        to="/collections/$handle"
        params={{ handle: target.handle }}
        search={search}
        onClick={onClick}
        className={className}
      >
        {content}
      </Link>
    )
  }
  return (
    <Link
      to="/categories/$handle"
      params={{ handle: target.handle }}
      search={search}
      onClick={onClick}
      className={className}
    >
      {content}
    </Link>
  )
}
