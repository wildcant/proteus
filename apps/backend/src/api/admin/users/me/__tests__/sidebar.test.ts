import type { PermissionKey } from '@core/types/access-control/common.js'
import { buildSettingsSidebar, buildSidebar } from '@workflows/admin/utils/build-sidebar.js'
import { describe, expect, test } from 'vitest'

describe('sidebar response contract', () => {
  test('items have { label, to } shape, no permission field', () => {
    const all = new Set<PermissionKey>(['product.read', 'order.read', 'customer.read', 'inventory.read'])
    const groups = buildSidebar(all)
    expect(groups.length).toBeGreaterThan(0)
    for (const group of groups) {
      expect(group).toHaveProperty('label')
      expect(group).toHaveProperty('items')
      for (const item of group.items) {
        expect(item).toHaveProperty('label')
        expect(item).toHaveProperty('to')
        expect(item).not.toHaveProperty('permission')
        expect(item.to).toMatch(/^\//)
        expect(item.to).not.toMatch(/^\/admin\//)
      }
    }
  })

  test('settings sidebar items have { label, to } shape', () => {
    const all = new Set<PermissionKey>(['store.read', 'user.read', 'access-control.role.read', 'region.read'])
    const groups = buildSettingsSidebar(all)
    expect(groups.length).toBeGreaterThan(0)
    for (const group of groups) {
      for (const item of group.items) {
        expect(item).toHaveProperty('label')
        expect(item).toHaveProperty('to')
        expect(item).not.toHaveProperty('permission')
      }
    }
  })

  test('filters items by allowed permissions', () => {
    const limited = new Set<PermissionKey>(['product.read'])
    const groups = buildSidebar(limited)
    expect(groups).toHaveLength(1)
    expect(groups.at(0)?.items).toHaveLength(1)
    expect(groups.at(0)?.items.at(0)?.label).toBe('Products')
  })

  test('emits known admin-app route targets', () => {
    const all = new Set<PermissionKey>(['product.read', 'order.read', 'customer.read', 'inventory.read'])
    const groups = buildSidebar(all)
    const paths = groups.flatMap((g) => g.items.map((i) => i.to))
    expect(paths).toEqual(['/orders', '/products', '/customers', '/inventory'])

    const settingsAll = new Set<PermissionKey>(['store.read', 'user.read', 'access-control.role.read', 'region.read'])
    const settingsGroups = buildSettingsSidebar(settingsAll)
    const settingsPaths = settingsGroups.flatMap((g) => g.items.map((i) => i.to))
    expect(settingsPaths).toEqual(['/settings/store', '/settings/users', '/settings/roles', '/settings/regions'])
  })
})
