import { Trans, useLingui } from '@lingui/react/macro'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  cn,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon, XIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Button } from '#/components/button'
import { isMenuGroup, type MenuGroup, MenuLink, useMenuEntries } from '#/components/header/menu'
import type { MenuSource } from '#/components/header/menu-items'
import { SearchBarTrigger } from '#/components/header/search-triggers'
import { ThemeToggle } from '#/components/theme-toggle'
import { useModal } from '#/lib/modal-state'

const rowClassName =
  'flex w-full items-center justify-between gap-3 py-4 text-base text-ink no-underline hover:text-ink-muted'

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
        className="bg-surface data-[swipe-direction=left]:rounded-none"
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
        <div className="flex shrink-0 items-center px-4 pt-6 pb-3 sm:px-6 lg:px-8">
          <DrawerClose render={<Button variant="ghost" size="icon" aria-label={t`Close menu`} className="-ml-2" />}>
            <XIcon className="h-5 w-5" />
          </DrawerClose>
        </div>

        <div className="shrink-0 px-4 pb-3 sm:px-6 lg:px-8">
          <SearchBarTrigger />
        </div>

        {/* The rail's destinations, from the same menu, nested: a Category with children expands in
            place, where the rail opens a panel. No `Cart` entry: the bag sits in
            the header at every width, and a nav link that opens a modal is a weaker copy of a
            control already on screen. */}
        <nav className="flex-1 overflow-y-auto px-4 pt-2 sm:px-6 lg:px-8">
          <ul className="m-0 flex list-none flex-col p-0">
            {entries.map((entry) => (
              <li key={entry.key}>
                {isMenuGroup(entry) ? (
                  <SideMenuGroup group={entry} />
                ) : (
                  <MenuLink destination={entry} className={rowClassName}>
                    {entry.label}
                    <ChevronRightIcon className="size-5 shrink-0" />
                  </MenuLink>
                )}
              </li>
            ))}
            <li>
              <Link to="/account" className={rowClassName}>
                <Trans>Account</Trans>
                <ChevronRightIcon className="size-5 shrink-0" />
              </Link>
            </li>
          </ul>
        </nav>

        <div className="mt-auto flex shrink-0 items-center justify-between border-line border-t px-4 py-4 sm:px-6 lg:px-8">
          <ThemeToggle />
          <p className="m-0 text-ink-muted text-xs">&copy; {new Date().getFullYear()} Proteus</p>
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
  const triggerClassName =
    'items-center font-normal text-ink **:data-[slot=accordion-trigger-icon]:size-5 **:data-[slot=accordion-trigger-icon]:text-ink'

  return (
    <Accordion>
      <AccordionItem value={group.key} className="not-last:border-b-0">
        <AccordionTrigger className={cn(triggerClassName, 'py-4 text-base')}>{group.label}</AccordionTrigger>
        <AccordionContent className="pb-2 [&_a]:no-underline">
          <ul className="m-0 flex list-none flex-col p-0 pl-4">
            {[group.shopAll, ...group.links].map((link) => (
              <li key={link.key}>
                <MenuLink destination={link} className={childClassName} />
              </li>
            ))}
            {group.sections.map((section) => (
              <li key={section.key}>
                <Accordion>
                  <AccordionItem value={section.key} className="not-last:border-b-0">
                    <AccordionTrigger className={cn(triggerClassName, 'py-3 text-base')}>
                      {section.title}
                    </AccordionTrigger>
                    <AccordionContent className="pb-2 [&_a]:no-underline">
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
