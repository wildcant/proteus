import { Button, Sheet, SheetTrigger } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { MenuIcon, ShoppingBagIcon } from 'lucide-react'
import { useState } from 'react'
import SideMenu from './side-menu'

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) backdrop-blur-lg">
      <nav className="page-wrap flex items-center justify-between px-4 py-3 sm:py-4">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" />}>
            <MenuIcon className="h-5 w-5" />
          </SheetTrigger>
          <SideMenu onClose={() => setMenuOpen(false)} />
        </Sheet>

        <Link
          to="/"
          className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full border border-(--chip-line) bg-(--chip-bg) px-3 py-1.5 text-sm font-semibold text-(--sea-ink) no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
        >
          <span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
          Proteus
        </Link>

        <Link
          to="/cart"
          aria-label="Cart"
          className="rounded-lg p-2 text-(--sea-ink) no-underline hover:bg-(--link-bg-hover)"
        >
          <ShoppingBagIcon className="h-5 w-5" />
        </Link>
      </nav>
    </header>
  )
}
