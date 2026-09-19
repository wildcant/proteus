import type { PermissionKey } from '@core/types/access-control/common.js'

type SidebarIcon =
  | 'shopping-cart'
  | 'package'
  | 'sliders-horizontal'
  | 'boxes'
  | 'clipboard-list'
  | 'users'
  | 'store'
  | 'shield'
  | 'globe'
  | 'settings'

type SidebarChildItem = { label: string; to: string; icon?: SidebarIcon }
type SidebarItem = { label: string; to: string; icon?: SidebarIcon; children?: SidebarChildItem[] }
type SidebarGroup = { label: string; items: SidebarItem[] }

type InternalChildItem = { label: string; to: string; icon?: SidebarIcon; permission: PermissionKey | null }
type InternalSidebarItem = {
  label: string
  to: string
  icon?: SidebarIcon
  permission: PermissionKey | null
  children?: InternalChildItem[]
}
type InternalSidebarGroup = { label: string; items: InternalSidebarItem[] }

const MAIN_SIDEBAR: InternalSidebarGroup[] = [
  {
    label: 'Store',
    items: [
      { label: 'Orders', to: '/orders', icon: 'shopping-cart', permission: 'order.read' },
      {
        label: 'Products',
        to: '/products',
        icon: 'package',
        permission: 'product.read',
        children: [
          { label: 'Options', to: '/product-options', icon: 'sliders-horizontal', permission: 'product.read' },
        ],
      },
      { label: 'Customers', to: '/customers', icon: 'users', permission: 'customer.read' },
      {
        label: 'Inventory',
        to: '/inventory',
        icon: 'boxes',
        permission: 'inventory.read',
        children: [
          { label: 'Reservations', to: '/reservations', icon: 'clipboard-list', permission: 'inventory.read' },
        ],
      },
    ],
  },
]

const SETTINGS_SIDEBAR: InternalSidebarGroup[] = [
  {
    label: 'General',
    items: [
      { label: 'Store', to: '/settings/store', permission: 'store.read' },
      { label: 'Users', to: '/settings/users', permission: 'user.read' },
      { label: 'Roles', to: '/settings/roles', permission: 'access-control.role.read' },
      { label: 'Regions', to: '/settings/regions', permission: 'region.read' },
    ],
  },
]

function stripPermission({ label, to, icon }: InternalChildItem): SidebarChildItem {
  return icon ? { label, to, icon } : { label, to }
}

function filterSidebar(groups: InternalSidebarGroup[], allowed: ReadonlySet<PermissionKey>): SidebarGroup[] {
  return groups.flatMap((group) => {
    const visible = group.items
      .filter((item) => item.permission === null || allowed.has(item.permission))
      .map((item): SidebarItem => {
        const base: SidebarItem = item.icon
          ? { label: item.label, to: item.to, icon: item.icon }
          : { label: item.label, to: item.to }
        if (item.children) {
          const visibleChildren = item.children
            .filter((child) => child.permission === null || allowed.has(child.permission))
            .map(stripPermission)
          if (visibleChildren.length > 0) {
            base.children = visibleChildren
          }
        }
        return base
      })
    if (visible.length === 0) return []
    return [{ label: group.label, items: visible }]
  })
}

export function buildSidebar(allowed: ReadonlySet<PermissionKey>): SidebarGroup[] {
  return filterSidebar(MAIN_SIDEBAR, allowed)
}

export function buildSettingsSidebar(allowed: ReadonlySet<PermissionKey>): SidebarGroup[] {
  return filterSidebar(SETTINGS_SIDEBAR, allowed)
}
