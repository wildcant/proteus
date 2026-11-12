import type { LucideIcon } from 'lucide-react'
import {
  BoxesIcon,
  ClipboardListIcon,
  FolderTreeIcon,
  GlobeIcon,
  LayersIcon,
  PackageIcon,
  SettingsIcon,
  ShapesIcon,
  ShieldIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  StoreIcon,
  TagsIcon,
  UsersIcon,
} from 'lucide-react'
import type { AdminMeResponseSidebarItem, AdminMeResponseSidebarItemItemsItemIcon } from '#/api/generated/model'

export type SidebarGroup = AdminMeResponseSidebarItem

export type SidebarIcon = AdminMeResponseSidebarItemItemsItemIcon

export const sidebarIcons: Record<SidebarIcon, LucideIcon> = {
  'shopping-cart': ShoppingCartIcon,
  package: PackageIcon,
  'sliders-horizontal': SlidersHorizontalIcon,
  'folder-tree': FolderTreeIcon,
  layers: LayersIcon,
  tags: TagsIcon,
  shapes: ShapesIcon,
  boxes: BoxesIcon,
  'clipboard-list': ClipboardListIcon,
  users: UsersIcon,
  store: StoreIcon,
  shield: ShieldIcon,
  globe: GlobeIcon,
  settings: SettingsIcon,
}
