import { SheetContent, SheetFooter, SheetHeader } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { HomeIcon, PackageIcon, ShoppingBagIcon, UserIcon } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'

const navLinks = [
  { to: '/' as const, label: 'Home', icon: HomeIcon },
  { to: '/products' as const, label: 'Products', icon: PackageIcon },
  { to: '/account' as const, label: 'Account', icon: UserIcon },
  { to: '/cart' as const, label: 'Cart', icon: ShoppingBagIcon },
]

export function SideMenu({ onClose }: { onClose: () => void }) {
  return (
    <SheetContent side="left" className="flex flex-col">
      <SheetHeader>
        <span className="font-semibold text-base text-foreground">Menu</span>
      </SheetHeader>

      <nav className="flex flex-1 flex-col gap-1 px-4">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-(--foreground-muted) text-sm no-underline hover:bg-(--bg-subtle) hover:text-foreground"
            activeProps={{ className: 'bg-(--bg-subtle) text-foreground' }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <SheetFooter className="border-border border-t px-4 py-4">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <p className="m-0 text-(--foreground-muted) text-xs">&copy; {new Date().getFullYear()} Proteus</p>
        </div>
      </SheetFooter>
    </SheetContent>
  )
}
