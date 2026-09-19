import type { LucideIcon } from 'lucide-react'
import {
  BoxesIcon,
  ClipboardListIcon,
  GlobeIcon,
  PackageIcon,
  SettingsIcon,
  ShieldIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  StoreIcon,
  UsersIcon,
} from 'lucide-react'
import type { AdminMeResponseSidebarItem, AdminMeResponseSidebarItemItemsItemIcon } from '#/api/generated/model'

export type SidebarGroup = AdminMeResponseSidebarItem

export type SidebarIcon = AdminMeResponseSidebarItemItemsItemIcon

export const sidebarIcons: Record<SidebarIcon, LucideIcon> = {
  'shopping-cart': ShoppingCartIcon,
  package: PackageIcon,
  'sliders-horizontal': SlidersHorizontalIcon,
  boxes: BoxesIcon,
  'clipboard-list': ClipboardListIcon,
  users: UsersIcon,
  store: StoreIcon,
  shield: ShieldIcon,
  globe: GlobeIcon,
  settings: SettingsIcon,
}
