import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@proteus/ui'
import { ChevronLeftIcon, XIcon } from 'lucide-react'
import { type CSSProperties, useEffect, useState } from 'react'
import { Button } from '#/components/button'
import { SearchForm } from '#/components/header/search-form'
import { SearchResults } from '#/features/products/components/search-results'
import { useModal } from '#/lib/modal-state'

/**
 * Search, as a panel that drops from the top over whatever the shopper was looking at.
 *
 * Composed the way admin's RouteFocusModal is, minus the routing: `swipeDirection="up"`
 * is what anchors a base-ui drawer to the top edge and makes it full-width and
 * auto-height, which is the desktop shape. Mobile pins it to 100dvh instead, where an
 * auto-height panel over a page would just be a worse full-screen search.
 *
 * Open state is the `?modal=search` param, read here rather than passed in — the panel is
 * URL state, so there is nothing for a parent to own. See `docs/adr/0019-modals-are-url-state.md`.
 */
export function SearchDrawer() {
  const { isOpen, setOpen } = useModal('search')
  const [term, setTerm] = useState('')

  // The panel keeps its term while open so the results can read it, and drops it on close —
  // reopening should be a fresh search, not the last one still on screen.
  useEffect(() => {
    if (!isOpen) setTerm('')
  }, [isOpen])

  return (
    <Drawer open={isOpen} onOpenChange={setOpen} swipeDirection="up">
      <DrawerContent
        className="border-line border-b bg-surface [--drawer-height:100dvh] data-[swipe-direction=up]:rounded-none lg:[--drawer-height:auto]"
        style={{ '--drawer-content-max-height': '100dvh' } as CSSProperties}
      >
        <DrawerTitle className="sr-only">Search</DrawerTitle>

        <div className="relative flex shrink-0 items-center gap-2 px-4 pt-6 pb-3 sm:px-6 lg:px-8">
          {/* Mobile dismisses with a back chevron rather than an X: the panel fills the screen
              there, so it reads as a place you navigated to, not a layer over the page. */}
          <DrawerClose
            render={<Button variant="ghost" size="icon" aria-label="Back" className="-ml-2 shrink-0 lg:hidden" />}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </DrawerClose>

          {/* flex-1 so the field takes the width the chevron leaves on mobile; capped and
              auto-margined above lg, where it centres on the bar instead. */}
          <SearchForm className="mx-auto flex-1 lg:max-w-lg" focusOnMount value={term} onChange={setTerm} />

          {/* Out of flow so the field centres against the viewport, not against the space left
              over beside it. */}
          <DrawerClose
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close search"
                className="absolute right-4 hidden shrink-0 sm:right-6 lg:right-8 lg:inline-flex"
              />
            }
          >
            <XIcon className="h-5 w-5" />
          </DrawerClose>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6 lg:px-8">
          <SearchResults term={term} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
