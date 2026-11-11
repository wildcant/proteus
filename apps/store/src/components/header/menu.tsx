import { useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { type MenuSource, type MenuTarget, resolveMenuItems } from '#/components/header/menu-items'

/** One destination: the catalogue when `target` is absent, otherwise that Category's or Collection's page. */
type MenuDestination = { key: string; label: string; target?: MenuTarget }

/**
 * A Category with children. It opens rather than navigates, so its own page is the first of
 * `links`, as "Shop all <name>".
 */
export type MenuGroup = { key: string; label: string; links: MenuDestination[] }

type MenuEntry = MenuDestination | MenuGroup

export const isMenuGroup = (entry: MenuEntry): entry is MenuGroup => 'links' in entry

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
    ...resolveMenuItems(source).map(({ key, label: name, target, children }): MenuEntry => {
      if (children.length === 0) return { key, label: name, target }
      return { key, label: name, links: [{ key, label: t`Shop all ${name}`, target }, ...children] }
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
  const { target } = destination
  if (!target) {
    return (
      <Link to="/" onClick={onClick} className={className}>
        {content}
      </Link>
    )
  }
  if (target.type === 'collection') {
    return (
      <Link to="/collections/$handle" params={{ handle: target.handle }} onClick={onClick} className={className}>
        {content}
      </Link>
    )
  }
  return (
    <Link to="/categories/$handle" params={{ handle: target.handle }} onClick={onClick} className={className}>
      {content}
    </Link>
  )
}
