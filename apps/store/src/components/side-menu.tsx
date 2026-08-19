import { SheetContent, SheetFooter, SheetHeader } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { HomeIcon, PackageIcon, ShoppingBagIcon, UserIcon } from 'lucide-react'
import ThemeToggle from './theme-toggle'

const navLinks = [
  { to: '/' as const, label: 'Home', icon: HomeIcon },
  { to: '/products' as const, label: 'Products', icon: PackageIcon },
  { to: '/account' as const, label: 'Account', icon: UserIcon },
  { to: '/cart' as const, label: 'Cart', icon: ShoppingBagIcon },
]

export default function SideMenu({ onClose }: { onClose: () => void }) {
  return (
    <SheetContent side="left" className="flex flex-col">
      <SheetHeader>
        <span className="text-base font-semibold text-(--sea-ink)">Menu</span>
      </SheetHeader>

      <nav className="flex flex-1 flex-col gap-1 px-4">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-(--sea-ink-soft) no-underline hover:bg-(--link-bg-hover) hover:text-(--sea-ink)"
            activeProps={{ className: 'bg-(--link-bg-hover) text-(--sea-ink)' }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <SheetFooter className="border-t border-(--line) px-4 py-4">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <p className="m-0 text-xs text-(--sea-ink-soft)">&copy; {new Date().getFullYear()} Proteus</p>
        </div>
      </SheetFooter>
    </SheetContent>
  )
}
