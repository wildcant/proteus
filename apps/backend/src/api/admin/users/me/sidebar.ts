import type { PermissionKey } from '@core/types/access-control/common.js'

type SidebarItem = { label: string; to: string; icon?: string }
type InternalSidebarItem = { label: string; to: string; icon?: string; permission: PermissionKey | null }
type SidebarGroup = { label: string; items: SidebarItem[] }
type InternalSidebarGroup = { label: string; items: InternalSidebarItem[] }

const MAIN_SIDEBAR: InternalSidebarGroup[] = [
  {
    label: 'Store',
    items: [
      { label: 'Products', to: '/admin/products', permission: 'product.read' },
      { label: 'Orders', to: '/admin/orders', permission: 'order.read' },
      { label: 'Customers', to: '/admin/customers', permission: 'customer.read' },
      { label: 'Inventory', to: '/admin/inventory-items', permission: 'inventory.read' },
      { label: 'Fulfillment', to: '/admin/fulfillment-sets', permission: 'fulfillment.read' },
    ],
  },
]

const SETTINGS_SIDEBAR: InternalSidebarGroup[] = [
  {
    label: 'Settings',
    items: [
      { label: 'Store', to: '/admin/settings/store', permission: 'store.read' },
      { label: 'Users', to: '/admin/settings/users', permission: 'user.read' },
      { label: 'Roles', to: '/admin/settings/roles', permission: 'access-control.role.read' },
      { label: 'Regions', to: '/admin/settings/regions', permission: 'region.read' },
      { label: 'Workflows', to: '/admin/settings/workflows', permission: null },
      { label: 'Profile', to: '/admin/settings/profile', permission: null },
    ],
  },
]

function filterSidebar(groups: InternalSidebarGroup[], allowed: ReadonlySet<PermissionKey>): SidebarGroup[] {
  return groups.flatMap((group) => {
    const visible = group.items
      .filter((item) => item.permission === null || allowed.has(item.permission))
      .map(({ label, to, icon }) => (icon ? { label, to, icon } : { label, to }))
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
