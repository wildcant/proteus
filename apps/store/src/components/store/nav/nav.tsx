import { cn } from '@proteus/ui-core'
import { isMenuGroup, MenuLink, useMenuEntries } from '#/components/header/menu'
import type { MenuSource } from '#/components/header/menu-items'
import { nav, navLink } from '#/components/store/nav/nav.variants'
import { RailPanel } from '#/components/store/rail-panel/rail-panel'

/**
 * The storefront's primary navigation, and the only part of the header that is navigation
 * in the landmark sense — which is why the `<nav>` element lives here rather than around
 * the whole bar. The wordmark, search, account and bag are the header's other business.
 *
 * Desktop only: the header hides it below `lg`, where the side menu carries these same
 * destinations, so a rail that merely collapsed would be the same links twice.
 */
type NavProps = {
  menu: MenuSource
  className?: string
}

export function Nav({ menu, className }: NavProps) {
  const entries = useMenuEntries(menu)

  return (
    <nav className={className}>
      <ul className={cn(nav(), 'm-0 list-none p-0')}>
        {entries.map((entry) => (
          <li key={entry.key}>
            {isMenuGroup(entry) ? (
              <RailPanel group={entry} />
            ) : (
              // The link's text is its own children, so the link carries the label's type.
              <MenuLink destination={entry} className={navLink()} />
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
