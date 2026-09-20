import type { GeneratedFeature } from '@core/access-control/features.gen.js'
import type { PermissionGrant, PermissionKey } from '@core/types/access-control/common.js'
import { test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'

const mockState = vi.hoisted(() => ({ features: [] as Array<{ id: string; title: string }> }))

vi.mock('@core/access-control/features.gen.js', () => ({
  // biome-ignore lint/style/useNamingConvention: must match generated export name
  get GENERATED_FEATURES() {
    return mockState.features
  },
}))

import { buildCascadeGraph } from '../../../core/db/cascade-graph.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import accessControlModule from '../index.js'
import { ActorRoleAssignmentRepository } from '../repositories/actor-role-assignment.js'
import { PermissionRepository } from '../repositories/permission.js'
import { RoleRepository } from '../repositories/role.js'
import { AccessControlModuleService } from '../services/access-control-module-service.js'

const cascadeGraph = buildCascadeGraph(accessControlModule.models)

const TEST_FEATURES: GeneratedFeature[] = [
  { id: 'product.read' as PermissionKey, title: 'Read products' },
  { id: 'product.create' as PermissionKey, title: 'Create products' },
  { id: 'product.update' as PermissionKey, title: 'Update products' },
  { id: 'product.delete' as PermissionKey, title: 'Delete products' },
  { id: 'order.read' as PermissionKey, title: 'Read orders' },
  { id: 'order.fulfill' as PermissionKey, title: 'Fulfill orders' },
  { id: 'access-control.role.write' as PermissionKey, title: 'Manage roles' },
]

let service: AccessControlModuleService
let roleRepository: RoleRepository

test.beforeEach(({ getDb, logger }) => {
  mockState.features = [...TEST_FEATURES]

  const permissionRepository = new PermissionRepository({ getDb, cascadeGraph })
  roleRepository = new RoleRepository({ getDb, cascadeGraph })
  const actorRoleAssignmentRepository = new ActorRoleAssignmentRepository({ getDb, cascadeGraph })
  const withTransaction = createWithTransaction(getDb)
  service = new AccessControlModuleService({
    permissionRepository,
    roleRepository,
    actorRoleAssignmentRepository,
    withTransaction,
    logger,
  })
})

test.describe('Role CRUD', () => {
  test('create, retrieve, list, soft-delete, restore', async ({ expect }) => {
    const role = await service.createRole({
      name: 'Editor',
      features: ['product.read' as PermissionKey, 'product.update' as PermissionKey],
    })
    expect(role.name).toBe('Editor')
    expect(role.features).toEqual(['product.read', 'product.update'])

    const retrieved = await service.retrieveRole(role.id)
    expect(retrieved.id).toBe(role.id)

    const [roles] = await service.listAndCountRoles()
    expect(roles).toHaveLength(1)

    await service.deleteRole(role.id)

    const [afterDelete] = await service.listAndCountRoles()
    expect(afterDelete).toHaveLength(0)
  })

  test('update role name and features', async ({ expect }) => {
    const role = await service.createRole({ name: 'Viewer', features: ['product.read' as PermissionKey] })

    const updated = await service.updateRole(role.id, {
      name: 'Reader',
      features: ['product.read' as PermissionKey, 'order.read' as PermissionKey],
    })

    expect(updated.name).toBe('Reader')
    expect(updated.features).toEqual(['product.read', 'order.read'])
  })

  test('role name uniqueness enforced on active roles', async ({ expect }) => {
    await service.createRole({ name: 'Admin', features: [] })

    await expect(service.createRole({ name: 'Admin', features: [] })).rejects.toThrow()
  })

  test('deleted role name can be reused', async ({ expect }) => {
    const role = await service.createRole({ name: 'Temp', features: [] })
    await service.deleteRole(role.id)

    const reused = await service.createRole({ name: 'Temp', features: [] })
    expect(reused.name).toBe('Temp')
    expect(reused.id).not.toBe(role.id)
  })
})

test.describe('Protected and super admin immutability', () => {
  test('super admin role cannot be modified', async ({ expect }) => {
    const superRole = await roleRepository.create({
      name: 'Super Admin',
      featuresJson: ['*'],
      isSuperAdmin: true,
      protected: true,
    })

    await expect(service.updateRole(superRole.id, { name: 'Not Super' })).rejects.toThrow(
      'Super admin role cannot be modified',
    )
    await expect(service.deleteRole(superRole.id)).rejects.toThrow('Protected role cannot be deleted')
  })

  test('protected role cannot be renamed or deleted but features can be edited', async ({ expect }) => {
    const protectedRole = await roleRepository.create({
      name: 'System Role',
      featuresJson: ['product.read'],
      protected: true,
    })

    await expect(service.updateRole(protectedRole.id, { name: 'Renamed' })).rejects.toThrow(
      'Protected role cannot be renamed',
    )
    await expect(service.deleteRole(protectedRole.id)).rejects.toThrow('Protected role cannot be deleted')

    const updated = await service.updateRole(protectedRole.id, {
      features: ['product.read' as PermissionKey, 'order.read' as PermissionKey],
    })
    expect(updated.features).toEqual(['product.read', 'order.read'])
  })
})

test.describe('Role deletion blocked with active assignments', () => {
  test('cannot delete role with active assignments', async ({ expect }) => {
    const role = await service.createRole({ name: 'Assigned', features: ['product.read' as PermissionKey] })
    await service.assignRoles('user', 'usr_1', [role.id], { callerGrantsIncludeSuperAdmin: false })

    await expect(service.deleteRole(role.id)).rejects.toThrow('Role is assigned to 1 user(s)')
  })
})

test.describe('Assignment CRUD and uniqueness', () => {
  test('assign and list roles for actor', async ({ expect }) => {
    const role1 = await service.createRole({ name: 'Role A', features: ['product.read' as PermissionKey] })
    const role2 = await service.createRole({ name: 'Role B', features: ['order.read' as PermissionKey] })

    await service.assignRoles('user', 'usr_1', [role1.id, role2.id], { callerGrantsIncludeSuperAdmin: false })

    const roles = await service.listActorRoles('user', 'usr_1')
    expect(roles).toHaveLength(2)
    expect(roles.map((r) => r.name).sort()).toEqual(['Role A', 'Role B'])
  })

  test('duplicate assignment is idempotent', async ({ expect }) => {
    const role = await service.createRole({ name: 'Single', features: ['product.read' as PermissionKey] })

    await service.assignRoles('user', 'usr_1', [role.id], { callerGrantsIncludeSuperAdmin: false })
    await service.assignRoles('user', 'usr_1', [role.id], { callerGrantsIncludeSuperAdmin: false })

    const roles = await service.listActorRoles('user', 'usr_1')
    expect(roles).toHaveLength(1)
  })

  test('revoke roles', async ({ expect }) => {
    const role = await service.createRole({ name: 'Revocable', features: ['product.read' as PermissionKey] })
    await service.assignRoles('user', 'usr_1', [role.id], { callerGrantsIncludeSuperAdmin: false })

    await service.revokeRoles('user', 'usr_1', [role.id])

    const roles = await service.listActorRoles('user', 'usr_1')
    expect(roles).toHaveLength(0)
  })
})

test.describe('resolvePermissions returns union of grants', () => {
  test('union across multiple roles', async ({ expect }) => {
    const role1 = await service.createRole({
      name: 'Catalog',
      features: ['product.read' as PermissionKey, 'product.update' as PermissionKey],
    })
    const role2 = await service.createRole({
      name: 'Orders',
      features: ['order.read' as PermissionKey, 'order.fulfill' as PermissionKey],
    })

    await service.assignRoles('user', 'usr_1', [role1.id, role2.id], { callerGrantsIncludeSuperAdmin: false })

    const grants = await service.resolvePermissions('user', 'usr_1')
    expect(grants.sort()).toEqual(['order.fulfill', 'order.read', 'product.read', 'product.update'])
  })
})

test.describe('resolveEffectiveFeatures expands wildcards', () => {
  test('module wildcard expands to all module permissions', async ({ expect }) => {
    const role = await service.createRole({ name: 'All Products', features: ['product.*'] })
    await service.assignRoles('user', 'usr_1', [role.id], { callerGrantsIncludeSuperAdmin: false })

    const features = await service.resolveEffectiveFeatures('user', 'usr_1')
    expect(features.sort()).toEqual(['product.create', 'product.delete', 'product.read', 'product.update'])
  })

  test('global wildcard expands to all registered permissions', async ({ expect }) => {
    const role = await roleRepository.create({
      name: 'Super',
      featuresJson: ['*'],
      isSuperAdmin: true,
      protected: true,
    })
    await service.assignRoles('user', 'usr_1', [role.id], { callerGrantsIncludeSuperAdmin: true })

    const features = await service.resolveEffectiveFeatures('user', 'usr_1')
    expect(features.length).toBe(TEST_FEATURES.length)
  })
})

test.describe('Permission sync', () => {
  test('sync creates permission rows from registry', async ({ expect }) => {
    await service.syncPermissions()

    const permissions = await service.listPermissions()
    expect(permissions).toHaveLength(TEST_FEATURES.length)
    expect(permissions.map((p) => p.key).sort()).toEqual(TEST_FEATURES.map((f) => f.id).sort())
  })

  test('sync is idempotent', async ({ expect }) => {
    await service.syncPermissions()
    await service.syncPermissions()

    const permissions = await service.listPermissions()
    expect(permissions).toHaveLength(TEST_FEATURES.length)
  })

  test('sync updates titles', async ({ expect }) => {
    await service.syncPermissions()

    mockState.features = TEST_FEATURES.map((f) => (f.id === 'product.read' ? { ...f, title: 'View products' } : f))

    await service.syncPermissions()

    const permissions = await service.listPermissions()
    const productRead = permissions.find((p) => p.key === 'product.read')
    expect(productRead?.title).toBe('View products')
  })

  test('sync soft-deletes unassigned unregistered permissions', async ({ expect }) => {
    await service.syncPermissions()

    mockState.features = TEST_FEATURES.filter((f) => f.id !== 'order.fulfill')

    await service.syncPermissions()

    const permissions = await service.listPermissions()
    expect(permissions.find((p) => p.key === 'order.fulfill')).toBeUndefined()
  })

  test('sync errors on unregistered permission still assigned to role', async ({ expect }) => {
    await service.syncPermissions()
    await service.createRole({ name: 'Has Fulfill', features: ['order.fulfill' as PermissionKey] })

    mockState.features = TEST_FEATURES.filter((f) => f.id !== 'order.fulfill')

    await expect(service.syncPermissions()).rejects.toThrow('Cannot remove permissions still assigned to roles')
  })

  test('sync restores re-registered permissions', async ({ expect }) => {
    await service.syncPermissions()

    mockState.features = TEST_FEATURES.filter((f) => f.id !== 'order.fulfill')
    await service.syncPermissions()

    mockState.features = [...TEST_FEATURES]
    await service.syncPermissions()

    const permissions = await service.listPermissions()
    expect(permissions.find((p) => p.key === 'order.fulfill')).toBeDefined()
  })
})

test.describe('Last super admin protection', () => {
  test('cannot revoke the last super admin assignment', async ({ expect }) => {
    const superRole = await roleRepository.create({
      name: 'Super Admin',
      featuresJson: ['*'],
      isSuperAdmin: true,
      protected: true,
    })
    await service.assignRoles('user', 'usr_admin', [superRole.id], { callerGrantsIncludeSuperAdmin: true })

    await expect(service.revokeRoles('user', 'usr_admin', [superRole.id])).rejects.toThrow(
      'Cannot revoke the last super admin assignment',
    )
  })

  test('can revoke super admin when another holder exists', async ({ expect }) => {
    const superRole = await roleRepository.create({
      name: 'Super Admin',
      featuresJson: ['*'],
      isSuperAdmin: true,
      protected: true,
    })
    await service.assignRoles('user', 'usr_admin1', [superRole.id], { callerGrantsIncludeSuperAdmin: true })
    await service.assignRoles('user', 'usr_admin2', [superRole.id], { callerGrantsIncludeSuperAdmin: true })

    await service.revokeRoles('user', 'usr_admin1', [superRole.id])

    const roles = await service.listActorRoles('user', 'usr_admin1')
    expect(roles).toHaveLength(0)
  })
})

test.describe('Self-escalation prevention', () => {
  test('assigning super admin role requires caller to hold super admin', async ({ expect }) => {
    const superRole = await roleRepository.create({
      name: 'Super Admin',
      featuresJson: ['*'],
      isSuperAdmin: true,
      protected: true,
    })

    await expect(
      service.assignRoles('user', 'usr_1', [superRole.id], { callerGrantsIncludeSuperAdmin: false }),
    ).rejects.toThrow('Assigning super admin role requires caller to hold super admin')
  })

  test('caller with super admin can assign super admin', async ({ expect }) => {
    const superRole = await roleRepository.create({
      name: 'Super Admin',
      featuresJson: ['*'],
      isSuperAdmin: true,
      protected: true,
    })

    await service.assignRoles('user', 'usr_1', [superRole.id], { callerGrantsIncludeSuperAdmin: true })

    const roles = await service.listActorRoles('user', 'usr_1')
    expect(roles).toHaveLength(1)
    expect(roles[0]?.name).toBe('Super Admin')
  })
})

test.describe('replaceRoles atomicity', () => {
  test('replace swaps all roles atomically', async ({ expect }) => {
    const role1 = await service.createRole({ name: 'Old Role', features: ['product.read' as PermissionKey] })
    const role2 = await service.createRole({ name: 'New Role', features: ['order.read' as PermissionKey] })

    await service.assignRoles('user', 'usr_1', [role1.id], { callerGrantsIncludeSuperAdmin: false })

    await service.replaceRoles('user', 'usr_1', [role2.id], { callerGrantsIncludeSuperAdmin: false })

    const roles = await service.listActorRoles('user', 'usr_1')
    expect(roles).toHaveLength(1)
    expect(roles[0]?.name).toBe('New Role')
  })

  test('replace with nonexistent role fails without partial application', async ({ expect }) => {
    const role1 = await service.createRole({ name: 'Good', features: ['product.read' as PermissionKey] })

    await service.assignRoles('user', 'usr_1', [role1.id], { callerGrantsIncludeSuperAdmin: false })

    await expect(
      service.replaceRoles('user', 'usr_1', [role1.id, 'nonexistent_id'], { callerGrantsIncludeSuperAdmin: false }),
    ).rejects.toThrow('Roles not found')

    const roles = await service.listActorRoles('user', 'usr_1')
    expect(roles).toHaveLength(1)
    expect(roles[0]?.name).toBe('Good')
  })

  test('replace enforces last super admin protection', async ({ expect }) => {
    const superRole = await roleRepository.create({
      name: 'Super Admin',
      featuresJson: ['*'],
      isSuperAdmin: true,
      protected: true,
    })
    const normalRole = await service.createRole({ name: 'Normal', features: ['product.read' as PermissionKey] })

    await service.assignRoles('user', 'usr_admin', [superRole.id], { callerGrantsIncludeSuperAdmin: true })

    await expect(
      service.replaceRoles('user', 'usr_admin', [normalRole.id], { callerGrantsIncludeSuperAdmin: false }),
    ).rejects.toThrow('Cannot revoke the last super admin assignment')
  })
})

test.describe('Duplicate feature ids error', () => {
  test('createRole rejects duplicate features', async ({ expect }) => {
    await expect(
      service.createRole({
        name: 'Duped',
        features: ['product.read' as PermissionKey, 'product.read' as PermissionKey],
      }),
    ).rejects.toThrow('Duplicate feature id')
  })

  test('updateRole rejects duplicate features', async ({ expect }) => {
    const role = await service.createRole({ name: 'Ok', features: ['product.read' as PermissionKey] })

    await expect(
      service.updateRole(role.id, { features: ['order.read' as PermissionKey, 'order.read' as PermissionKey] }),
    ).rejects.toThrow('Duplicate feature id')
  })
})

test.describe('Grant validation against registered features', () => {
  test('rejects unknown concrete permission key', async ({ expect }) => {
    await expect(service.createRole({ name: 'Bad', features: ['nonexistent.perm' as PermissionKey] })).rejects.toThrow(
      'Unknown permission key: nonexistent.perm',
    )
  })

  test('rejects unknown module wildcard', async ({ expect }) => {
    await expect(service.createRole({ name: 'Bad', features: ['fake.*' as PermissionGrant] })).rejects.toThrow(
      'Unknown module wildcard: fake.*',
    )
  })

  test('accepts valid module wildcard', async ({ expect }) => {
    const role = await service.createRole({ name: 'All Products', features: ['product.*'] })
    expect(role.features).toEqual(['product.*'])
  })

  test('rejects global wildcard on createRole', async ({ expect }) => {
    await expect(service.createRole({ name: 'Super', features: ['*'] })).rejects.toThrow(
      'Global wildcard grant is reserved for the super admin role',
    )
  })

  test('rejects global wildcard on updateRole', async ({ expect }) => {
    const role = await service.createRole({
      name: 'Editor',
      features: ['product.read' as PermissionKey],
    })
    await expect(service.updateRole(role.id, { features: ['*'] })).rejects.toThrow(
      'Global wildcard grant is reserved for the super admin role',
    )
  })
})
