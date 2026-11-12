import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Link, useNavigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { HeaderLinks } from '#/components/header/header-links'
import type { MenuSource } from '#/components/header/menu-items'
import { SearchBarTrigger, SearchIconTrigger } from '#/components/header/search-triggers'
import {
  header,
  headerAccountButton,
  headerActions,
  headerBar,
  headerEnd,
  headerMenuButton,
  headerNav,
  headerSearchBar,
  headerSearchButton,
  headerStart,
  headerWordmark,
} from '#/components/store/header/header.variants'
import { Nav } from '#/components/store/nav/nav'
import { SideMenu } from '#/components/store/side-menu/side-menu'
import { Wordmark } from '#/components/store/wordmark/wordmark'
import { Button } from '#/components/ui/button/button'
import { Icon } from '#/components/ui/icon/icon'

/**
 * The bar itself: nav, wordmark, search triggers, account link.
 *
 * `actions` is a slot because the bag belongs in the action cluster but reads the cart, and shared
 * chrome may not reach up into a feature. The two drawers used to mount here too; they are portalled
 * overlays whose open state is a URL param, so they are siblings in the `_main` layout route now
 * rather than props threaded through the bar. See `packages/frontend-structure` for the rule.
 */
export function Header({
  menu,
  links,
  actions,
}: {
  /** What the rail and the side menu draw from, read by the layout route. */
  menu: MenuSource
  links: HeaderLinks
  actions?: ReactNode
}) {
  const { t } = useLingui()
  const navigate = useNavigate()

  return (
    <header className={cn(header(), 'sticky top-0 z-50')}>
      {/* Two equal flex-1 flanks rather than an absolutely positioned wordmark: with a rail on
          the left and a 280px search control on the right, an absolute wordmark overlaps both.
          `mx-auto w-full` centres the capped bar, which the design file draws as stretched. */}
      <div className={cn(headerBar(), 'mx-auto w-full')}>
        <div className={headerStart()}>
          {/* The rail replaces the menu above lg, where it would be duplicate navigation. */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t`Open menu`}
            className={cn(headerMenuButton(), '-ml-2')}
            onClick={() => navigate(links.openMenu)}
          >
            <Icon name="menu" className="h-5 w-5" />
          </Button>

          <SearchIconTrigger openLink={links.openSearch} className={headerSearchButton()} />

          <Nav menu={menu} menuLink={links.menu} className={headerNav()} />
        </div>

        <Wordmark link={links.home} className={headerWordmark()} />

        <div className={headerEnd()}>
          <SearchBarTrigger openLink={links.openSearch} className={headerSearchBar()} />

          {/* Account before bag, as the reference has it — the bag is the last thing on the
              bar because it is the one the shopper reaches for mid-task. */}
          <Link {...links.account}>
            <Button variant="ghost" size="icon" aria-label={t`Account`} className={headerAccountButton()}>
              <Icon name="user" className="h-5 w-5" />
            </Button>
          </Link>

          <div className={headerActions()}>{actions}</div>
        </div>
      </div>

      <SideMenu menu={menu} links={links} />
    </header>
  )
}
