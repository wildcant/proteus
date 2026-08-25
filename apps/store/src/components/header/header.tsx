import { UserIcon } from '@proteus/icons'
import { Link } from '@tanstack/react-router'
import { MenuIcon } from 'lucide-react'
import { Button } from '#/components/button'
import { Nav } from '#/components/header/nav'
import { SearchDrawer } from '#/components/header/search-drawer'
import { SearchBarTrigger, SearchIconTrigger } from '#/components/header/search-triggers'
import { Wordmark } from '#/components/header/wordmark'
import { CartDropdown } from '#/features/cart/components/cart-dropdown'
import { useModal } from '#/lib/modal-state'
import { SideMenu } from './side-menu'

export function Header() {
  const { setOpen: setMenuOpen } = useModal('menu')

  return (
    <header className="sticky top-0 z-50 border-line border-b bg-surface">
      {/* Three columns rather than a flex row with an absolutely positioned wordmark:
          with a rail on the left and a 280px search control on the right, an absolute
          wordmark overlaps both. Equal 1fr flanks centre it on the bar instead. */}
      <div className="mx-auto grid h-14 w-full max-w-350 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6 lg:h-20 lg:px-8">
        <div className="flex items-center">
          {/* The rail replaces the menu above lg, where it would be duplicate navigation. */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open menu"
            className="-ml-2 lg:hidden"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon className="h-5 w-5" />
          </Button>

          <SearchIconTrigger className="lg:hidden" />

          <Nav />
        </div>

        <Wordmark />

        <div className="flex items-center gap-1 justify-self-end">
          <SearchBarTrigger className="hidden w-70 lg:flex" />

          {/* Account before bag, as the reference has it — the bag is the last thing on the
              bar because it is the one the shopper reaches for mid-task. */}
          <Link to="/account">
            <Button variant="ghost" size="icon" aria-label="Account">
              <UserIcon className="h-5 w-5" />
            </Button>
          </Link>

          <CartDropdown />
        </div>
      </div>

      <SideMenu />
      <SearchDrawer />
    </header>
  )
}
