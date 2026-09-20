import {
  BoxesIcon,
  ClipboardListIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

export type NavItem = {
  label: string
  to: string
  icon: ReactNode
  children?: NavItem[]
}

export const navItems: NavItem[] = [
  { label: 'Orders', to: '/orders', icon: <ShoppingCartIcon /> },
  {
    label: 'Products',
    to: '/products',
    icon: <PackageIcon />,
    children: [{ label: 'Options', to: '/product-options', icon: <SlidersHorizontalIcon /> }],
  },
  {
    // Reservations are a lens on inventory rather than a peer of it, so they sit beneath it.
    label: 'Inventory',
    to: '/inventory',
    icon: <BoxesIcon />,
    children: [{ label: 'Reservations', to: '/reservations', icon: <ClipboardListIcon /> }],
  },
]

export const settingsItem: NavItem = {
  label: 'Settings',
  to: '/settings/store',
  icon: <SettingsIcon />,
}
