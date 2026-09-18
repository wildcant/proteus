import type { PermissionKey } from '@core/types/access-control/common.js'

type SidebarItem = { label: string; permission: PermissionKey | null }
type SidebarGroup = { label: string; items: SidebarItem[] }

const MAIN_SIDEBAR: SidebarGroup[] = [
  {
    label: 'Store',
    items: [
      { label: 'Products', permission: 'product.read' },
      { label: 'Orders', permission: 'order.read' },
      { label: 'Customers', permission: 'customer.read' },
      { label: 'Inventory', permission: 'inventory.read' },
      { label: 'Fulfillment', permission: 'fulfillment.read' },
    ],
  },
]

const SETTINGS_SIDEBAR: SidebarGroup[] = [
  {
    label: 'Settings',
    items: [
      { label: 'Store', permission: 'store.read' },
      { label: 'Users', permission: 'user.read' },
      { label: 'Roles', permission: 'access-control.role.read' },
      { label: 'Regions', permission: 'region.read' },
      { label: 'Workflows', permission: null },
      { label: 'Profile', permission: null },
    ],
  },
]

function filterSidebar(groups: SidebarGroup[], allowed: ReadonlySet<PermissionKey>): SidebarGroup[] {
  return groups.flatMap((group) => {
    const visible = group.items.filter((item) => item.permission === null || allowed.has(item.permission))
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
