import { useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { type MenuSection, type MenuSource, type MenuTarget, resolveMenuItems } from '#/components/header/menu-items'
import type { LinkTarget } from '#/lib/link-target'

/** Where a menu destination goes, from the route: the catalogue when `target` is absent, otherwise that page. */
export type MenuLinkTo = (target?: MenuTarget) => LinkTarget

/** One destination, with the link the route made for it. */
type MenuDestination = { key: string; label: string; link: LinkTarget }

/** One titled column of an entry's panel, its links resolved. */
type MenuGroupSection = Omit<MenuSection, 'links'> & { links: MenuDestination[] }

/**
 * A menu entry that opens rather than navigates, so its own page is `shopAll`, "Shop all <name>".
 * A Category with children lists them in `links`; an entry with sections lays them out as titled
 * columns in `sections` instead, and has no `links`.
 */
export type MenuGroup = {
  key: string
  label: string
  shopAll: MenuDestination
  links: MenuDestination[]
  sections: MenuGroupSection[]
}

type MenuEntry = MenuDestination | MenuGroup

export const isMenuGroup = (entry: MenuEntry): entry is MenuGroup => 'shopAll' in entry

/**
 * The storefront's navigation as data, which the header rail and the side menu each render in
 * their own shape: "Shop all", then the store's menu (see `resolveMenuItems`). No grouping is
 * named in code, so the same menu serves any shop — and one with nothing on its menu still has a
 * way to the catalogue.
 */
export function useMenuEntries(source: MenuSource, linkTo: MenuLinkTo): MenuEntry[] {
  const { t } = useLingui()
  const destination = ({ key, label, target }: { key: string; label: string; target?: MenuTarget }) => ({
    key,
    label,
    link: linkTo(target),
  })

  return [
    destination({ key: 'shop-all', label: t`Shop all` }),
    ...resolveMenuItems(source).map(({ key, label: name, target, children, sections }): MenuEntry => {
      if (children.length === 0 && sections.length === 0) return destination({ key, label: name, target })
      return {
        key,
        label: name,
        shopAll: destination({ key, label: t`Shop all ${name}`, target }),
        links: children.map(destination),
        sections: sections.map((section) => ({ ...section, links: section.links.map(destination) })),
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
  return (
    <Link {...destination.link} onClick={onClick} className={className}>
      {children ?? destination.label}
    </Link>
  )
}
