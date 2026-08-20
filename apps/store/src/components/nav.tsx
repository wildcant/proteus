import { Sheet, SheetTrigger } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { MenuIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '#/components/button'
import { CartDropdown } from '#/features/cart/components/cart-dropdown'
import { SideMenu } from './side-menu'

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-border border-b bg-white dark:bg-neutral-950">
      <nav className="mx-auto flex w-full max-w-350 items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
            <MenuIcon className="h-5 w-5" />
          </SheetTrigger>
          <SideMenu onClose={() => setMenuOpen(false)} />
        </Sheet>

        <Link
          to="/"
          className="absolute left-1/2 -translate-x-1/2 font-semibold text-foreground text-sm uppercase tracking-[0.2em] no-underline hover:text-(--foreground-muted)"
        >
          Proteus
        </Link>

        <CartDropdown />
      </nav>
    </header>
  )
}
