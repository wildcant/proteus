import { Sheet, SheetTrigger } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { MenuIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/button'
import { CartDropdown } from '#/features/cart/components/cart-dropdown'
import SideMenu from './side-menu'

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-(--border) bg-white dark:bg-neutral-950">
      <nav className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
            <MenuIcon className="h-5 w-5" />
          </SheetTrigger>
          <SideMenu onClose={() => setMenuOpen(false)} />
        </Sheet>

        <Link
          to="/"
          className="absolute left-1/2 -translate-x-1/2 text-sm font-semibold uppercase tracking-[0.2em] text-(--foreground) no-underline hover:text-(--foreground-muted)"
        >
          Proteus
        </Link>

        <CartDropdown />
      </nav>
    </header>
  )
}
