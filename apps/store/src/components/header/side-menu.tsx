import { Trans, useLingui } from '@lingui/react/macro'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { ChevronRightIcon, XIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { StoreProductCategoryTreeNode } from '#/api/generated/model'
import { useSuspenseCategoryTree } from '#/api/product-categories'
import { Button } from '#/components/button'
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
export function SideMenu() {
  const { t } = useLingui()
  const { isOpen, setOpen } = useModal('menu')
  const categories = useSuspenseCategoryTree()

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

        {/* The rail's destinations, nested: a Category with children expands in place to "Shop all
            <name>" and its children, where the rail opens a panel. No `Cart` entry: the bag sits in
            the header at every width, and a nav link that opens a modal is a weaker copy of a
            control already on screen. */}
        <nav className="flex-1 overflow-y-auto px-4 pt-2 sm:px-6 lg:px-8">
          <ul className="m-0 flex list-none flex-col p-0">
            <li>
              <Link to="/" className={rowClassName}>
                <Trans>Shop all</Trans>
                <ChevronRightIcon className="size-5 shrink-0" />
              </Link>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                {category.children.length > 0 ? (
                  <SideMenuCategory category={category} />
                ) : (
                  <Link to="/categories/$handle" params={{ handle: category.handle }} className={rowClassName}>
                    {category.name}
                    <ChevronRightIcon className="size-5 shrink-0" />
                  </Link>
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

/** Following any of its links closes the menu for free — see `SideMenu` — so this holds no state. */
function SideMenuCategory({ category }: { category: StoreProductCategoryTreeNode }) {
  const { name } = category
  const childClassName = 'block py-3 text-base text-ink-muted no-underline hover:text-ink'

  return (
    <Accordion>
      <AccordionItem value={category.id} className="not-last:border-b-0">
        <AccordionTrigger className="items-center py-4 font-normal text-base text-ink **:data-[slot=accordion-trigger-icon]:size-5 **:data-[slot=accordion-trigger-icon]:text-ink">
          {name}
        </AccordionTrigger>
        <AccordionContent className="pb-2 [&_a]:no-underline">
          <ul className="m-0 flex list-none flex-col p-0 pl-4">
            <li>
              <Link to="/categories/$handle" params={{ handle: category.handle }} className={childClassName}>
                <Trans>Shop all {name}</Trans>
              </Link>
            </li>
            {category.children.map((child) => (
              <li key={child.id}>
                <Link to="/categories/$handle" params={{ handle: child.handle }} className={childClassName}>
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
