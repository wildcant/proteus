import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import { isMenuGroup, type MenuGroup, MenuLink, useMenuEntries } from '#/components/header/menu'
import type { MenuSource } from '#/components/header/menu-items'
import { SearchBarTrigger } from '#/components/header/search-triggers'
import {
  sideMenu,
  sideMenuChevron,
  sideMenuCloseButton,
  sideMenuCopyright,
  sideMenuFooter,
  sideMenuGlyph,
  sideMenuGroup,
  sideMenuLabel,
  sideMenuNav,
  sideMenuRow,
  sideMenuSearch,
  sideMenuSearchBar,
  sideMenuThemeToggle,
  sideMenuTop,
} from '#/components/store/side-menu/side-menu.variants'
import { ThemeToggle } from '#/components/store/theme-toggle/theme-toggle'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '#/components/ui/accordion/accordion'
import { Button } from '#/components/ui/button/button'
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '#/components/ui/drawer/drawer'
import { Icon } from '#/components/ui/icon/icon'
import { useModal } from '#/lib/modal-state'

/** A row's text is its own children, so the row carries the label's type. */
const rowClassName = cn(sideMenuRow(), sideMenuLabel())

/** The chevron fades with its row's hover (the row is `group/side-menu-row`). */
const chevronClassName = cn(sideMenuChevron(), sideMenuGlyph(), 'shrink-0 transition-[color] ease-[ease]')

/** The drawer is reachable above `lg` only by URL; the design file draws it up to `sm`. */
const LG_GUTTER = 'lg:px-8'

/**
 * The mobile navigation, as a drawer off the left edge — same primitive as the search panel,
 * so both overlays swipe, stack and animate identically.
 *
 * Open state is `?modal=menu`. That is what makes every dismissal free: a row is a plain
 * `<Link>`, and TanStack drops search params on navigation, so following one closes the menu
 * without an onClick. The search trigger sets `modal` to `search` in a single navigation, so
 * the menu closes exactly as the panel opens rather than the two overlapping.
 */
export function SideMenu({ menu }: { menu: MenuSource }) {
  const { t } = useLingui()
  const { isOpen, setOpen } = useModal('menu')
  const entries = useMenuEntries(menu)

  return (
    <Drawer open={isOpen} onOpenChange={setOpen} swipeDirection="left">
      <DrawerContent
        className={cn(sideMenu(), 'data-[swipe-direction=left]:rounded-none')}
        // Inline rather than a class: the primitive sets this variable behind a
        // `data-[swipe-axis=x]:` variant, whose attribute selector outranks a bare utility, so
        // a className override loses and the drawer stays at the default 75%.
        style={{ '--drawer-content-width': '100%' } as CSSProperties}
      >
        <DrawerTitle className="sr-only">
          <Trans>Menu</Trans>
        </DrawerTitle>

        {/* Close sits inline-start, mirroring the hamburger it replaces rather than landing
            in the far corner the way the primitive's default close does. */}
        <div className={cn(sideMenuTop(), 'shrink-0', LG_GUTTER)}>
          <DrawerClose
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={t`Close menu`}
                className={cn(sideMenuCloseButton(), '-ml-2')}
              />
            }
          >
            <Icon name="x" className="h-5 w-5" />
          </DrawerClose>
        </div>

        <div className={cn(sideMenuSearch(), 'shrink-0', LG_GUTTER)}>
          <SearchBarTrigger className={sideMenuSearchBar()} />
        </div>

        {/* The rail's destinations, from the same menu, nested: a Category with children expands in
            place, where the rail opens a panel. No `Cart` entry: the bag sits in
            the header at every width, and a nav link that opens a modal is a weaker copy of a
            control already on screen. */}
        <nav className={cn(sideMenuNav(), LG_GUTTER)}>
          <ul className="m-0 flex list-none flex-col p-0">
            {entries.map((entry) => (
              <li key={entry.key}>
                {isMenuGroup(entry) ? (
                  <SideMenuGroup group={entry} />
                ) : (
                  <MenuLink destination={entry} className={rowClassName}>
                    {entry.label}
                    <Icon name="chevron-right" className={chevronClassName} />
                  </MenuLink>
                )}
              </li>
            ))}
            <li>
              <Link to="/account" className={rowClassName}>
                <Trans>Account</Trans>
                <Icon name="chevron-right" className={chevronClassName} />
              </Link>
            </li>
          </ul>
        </nav>

        <div className={cn(sideMenuFooter(), 'mt-auto shrink-0', LG_GUTTER)}>
          <ThemeToggle className={sideMenuThemeToggle()} />
          <p className={cn(sideMenuCopyright(), 'm-0')}>&copy; {new Date().getFullYear()} Proteus</p>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * Following any of its links closes the menu for free — see `SideMenu` — so this holds no state.
 * Sections nest as groups of their own inside the entry's, each expanding in place like the entry.
 */
function SideMenuGroup({ group }: { group: MenuGroup }) {
  const childClassName = 'block py-3 text-base text-ink-muted no-underline hover:text-ink'

  return (
    <Accordion className={sideMenuGroup()}>
      <AccordionItem value={group.key}>
        <AccordionTrigger>{group.label}</AccordionTrigger>
        <AccordionContent>
          <ul className="m-0 flex list-none flex-col p-0 pl-4">
            {[group.shopAll, ...group.links].map((link) => (
              <li key={link.key}>
                <MenuLink destination={link} className={childClassName} />
              </li>
            ))}
            {group.sections.map((section) => (
              <li key={section.key}>
                <Accordion variant="section">
                  <AccordionItem value={section.key}>
                    <AccordionTrigger>{section.title}</AccordionTrigger>
                    <AccordionContent>
                      <ul className="m-0 flex list-none flex-col p-0 pl-4">
                        {section.links.map((link) => (
                          <li key={link.key}>
                            <MenuLink destination={link} className={childClassName} />
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
