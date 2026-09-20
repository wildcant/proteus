import type { PermissionGrant } from '@core/types/access-control/common.js'
import type { IAccessControlModuleService } from '@core/types/access-control/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { authHeader } from '@tests/utils/auth-header.js'
import { sql } from 'drizzle-orm'
import type * as permissionByIdRoutes from '../../permissions/[id]/route.js'
import adminPermissionDefinitions from '../../permissions/definitions.js'
import type * as permissionRoutes from '../../permissions/route.js'
import type * as userRoleRoutes from '../../users/[id]/roles/route.js'
import adminUserDefinitions from '../../users/definitions.js'
import type * as roleByIdRoutes from '../[id]/route.js'
import roleDefinitions from '../definitions.js'
import type * as roleRoutes from '../route.js'

const definitions = [...roleDefinitions, ...adminPermissionDefinitions, ...adminUserDefinitions]

const grants = (...keys: string[]) => keys as PermissionGrant[]

let api: TestApi
let accessControl: IAccessControlModuleService
let markSuperAdmin: (roleId: string) => Promise<unknown>

const ADMIN_USER = 'user_admin'
const VIEWER_USER = 'user_viewer'
const UNASSIGNED_USER = 'user_unassigned'

test.beforeEach(async ({ createApi, getDb }) => {
  const db = getDb()
  markSuperAdmin = (roleId: string) =>
    db.execute(
      sql`UPDATE role SET is_super_admin = true, protected = true, features_json = '["*"]'::jsonb WHERE id = ${roleId}`,
    )
  api = await createApi({ definitions, namespaceAuth: true })
  accessControl = api.container.resolve(Modules.ACCESS_CONTROL)

  const adminRole = await accessControl.createRole({
    name: 'Admin',
    features: grants(
      'access-control.role.read',
      'access-control.role.manage',
      'access-control.assignment.read',
      'access-control.assignment.manage',
    ),
  })
  await accessControl.assignRolesToUser(ADMIN_USER, [adminRole.id])

  const viewerRole = await accessControl.createRole({
    name: 'Viewer',
    features: grants('access-control.role.read', 'access-control.assignment.read'),
  })
  await accessControl.assignRolesToUser(VIEWER_USER, [viewerRole.id])
})

const listRoles = (headers?: Record<string, string>) =>
  api.get<typeof roleRoutes.GetOutput>('/admin/roles', undefined, { headers })

const createRole = (body: object, headers?: Record<string, string>) =>
  api.post<typeof roleRoutes.PostOutput>('/admin/roles', body, { headers })

const getRole = (id: string, headers?: Record<string, string>) =>
  api.get<typeof roleByIdRoutes.GetOutput>(`/admin/roles/${id}`, undefined, { headers })

const updateRole = (id: string, body: object, headers?: Record<string, string>) =>
  api.patch<typeof roleByIdRoutes.PatchOutput>(`/admin/roles/${id}`, body, { headers })

const deleteRole = (id: string, headers?: Record<string, string>) =>
  api.delete<typeof roleByIdRoutes.DeleteOutput>(`/admin/roles/${id}`, undefined, { headers })

const listPermissions = (headers?: Record<string, string>) =>
  api.get<typeof permissionRoutes.GetOutput>('/admin/permissions', undefined, { headers })

const getPermission = (id: string, headers?: Record<string, string>) =>
  api.get<typeof permissionByIdRoutes.GetOutput>(`/admin/permissions/${id}`, undefined, { headers })

const listUserRoles = (userId: string, headers?: Record<string, string>) =>
  api.get<typeof userRoleRoutes.GetOutput>(`/admin/users/${userId}/roles`, undefined, { headers })

const replaceUserRoles = (userId: string, body: object, headers?: Record<string, string>) =>
  api.put<typeof userRoleRoutes.PutOutput>(`/admin/users/${userId}/roles`, body, { headers })

test.describe('authentication', () => {
  test('401 for unauthenticated requests', async ({ expect }) => {
    const roles = await api.get<ApiErrorBody>('/admin/roles')
    const perms = await api.get<ApiErrorBody>('/admin/permissions')

    expect(roles.status).toBe(401)
    expect(perms.status).toBe(401)
  })
})

test.describe('authorization', () => {
  test('403 without required permission', async ({ expect }) => {
    const headers = authHeader('user', UNASSIGNED_USER)

    const roles = await api.get<ApiErrorBody>('/admin/roles', undefined, { headers })
    const perms = await api.get<ApiErrorBody>('/admin/permissions', undefined, { headers })

    expect(roles.status).toBe(403)
    expect(perms.status).toBe(403)
  })

  test('viewer cannot create, update, or delete roles', async ({ expect }) => {
    const headers = authHeader('user', VIEWER_USER)
    const role = await accessControl.createRole({ name: 'Target', features: grants() })

    const create = await api.post<ApiErrorBody>('/admin/roles', { name: 'New', features: [] }, { headers })
    const update = await api.patch<ApiErrorBody>(`/admin/roles/${role.id}`, { name: 'Renamed' }, { headers })
    const del = await api.delete<ApiErrorBody>(`/admin/roles/${role.id}`, undefined, { headers })

    expect(create.status).toBe(403)
    expect(update.status).toBe(403)
    expect(del.status).toBe(403)
  })
})

test.describe('GET /admin/permissions', () => {
  test('lists registered permissions', async ({ expect }) => {
    await accessControl.syncPermissions()
    const headers = authHeader('user', ADMIN_USER)

    const { status, body } = await listPermissions(headers)

    expect(status).toBe(200)
    expect(body.permissions.length).toBeGreaterThan(0)
    expect(body.permissions[0]).toHaveProperty('key')
    expect(body.permissions[0]).toHaveProperty('module')
  })
})

test.describe('GET /admin/permissions/:id', () => {
  test('retrieves a single permission', async ({ expect }) => {
    await accessControl.syncPermissions()
    const headers = authHeader('user', ADMIN_USER)
    const all = await accessControl.listPermissions()
    const target = all[0] as (typeof all)[number]

    const { status, body } = await getPermission(target.id, headers)

    expect(status).toBe(200)
    expect(body.permission.id).toBe(target.id)
    expect(body.permission.key).toBe(target.key)
  })
})

test.describe('role CRUD happy path', () => {
  test('create, retrieve, list, update, delete', async ({ expect }) => {
    const headers = authHeader('user', ADMIN_USER)

    const created = await createRole({ name: 'Editor', features: ['product.read', 'product.update'] }, headers)
    expect(created.status).toBe(201)
    expect(created.body.role.name).toBe('Editor')
    expect(created.body.role.features).toEqual(['product.read', 'product.update'])

    const retrieved = await getRole(created.body.role.id, headers)
    expect(retrieved.status).toBe(200)
    expect(retrieved.body.role.id).toBe(created.body.role.id)
    expect(retrieved.body.role.userCount).toBe(0)

    const listed = await listRoles(headers)
    expect(listed.status).toBe(200)
    const editorInList = listed.body.roles.find((r) => r.id === created.body.role.id)
    expect(editorInList).toBeDefined()

    const updated = await updateRole(
      created.body.role.id,
      { name: 'Senior Editor', features: ['product.read', 'product.update', 'product.create'] },
      headers,
    )
    expect(updated.status).toBe(200)
    expect(updated.body.role.name).toBe('Senior Editor')
    expect(updated.body.role.features).toEqual(['product.read', 'product.update', 'product.create'])

    const deleted = await deleteRole(created.body.role.id, headers)
    expect(deleted.status).toBe(200)
    expect(deleted.body.deleted).toBe(true)
  })
})

test.describe('super admin immutability via API', () => {
  test('cannot update or delete a super admin role', async ({ expect }) => {
    const headers = authHeader('user', ADMIN_USER)
    const roles = await accessControl.listRoles()
    let superAdminRole = roles.find((r) => r.isSuperAdmin)

    if (!superAdminRole) {
      const role = await accessControl.createRole({
        name: 'Super Admin Test',
        features: grants('access-control.role.read'),
      })
      await markSuperAdmin(role.id)
      superAdminRole = await accessControl.retrieveRole(role.id)
    }

    const updateResult = await api.patch<ApiErrorBody>(
      `/admin/roles/${superAdminRole.id}`,
      { name: 'Renamed' },
      { headers },
    )
    expect(updateResult.status).toBe(400)

    const deleteResult = await api.delete<ApiErrorBody>(`/admin/roles/${superAdminRole.id}`, undefined, { headers })
    expect(deleteResult.status).toBe(400)
  })
})

test.describe('role deletion blocked with active assignments', () => {
  test('400 when role has active assignments, includes user count', async ({ expect }) => {
    const headers = authHeader('user', ADMIN_USER)
    const role = await accessControl.createRole({ name: 'Assigned Role', features: grants('product.read') })
    await accessControl.assignRolesToUser('user_test1', [role.id])
    await accessControl.assignRolesToUser('user_test2', [role.id])

    const result = await api.delete<ApiErrorBody>(`/admin/roles/${role.id}`, undefined, { headers })

    expect(result.status).toBe(400)
    expect(result.body.message).toContain('2')
  })
})

test.describe('self-escalation prevention', () => {
  test('non-super-admin cannot assign super admin role', async ({ expect }) => {
    const headers = authHeader('user', ADMIN_USER)

    const roles = await accessControl.listRoles()
    let superAdminRole = roles.find((r) => r.isSuperAdmin)
    if (!superAdminRole) {
      const role = await accessControl.createRole({ name: 'SA', features: grants('access-control.role.read') })
      await markSuperAdmin(role.id)
      superAdminRole = await accessControl.retrieveRole(role.id)
    }

    const result = await api.put<ApiErrorBody>(
      `/admin/users/${UNASSIGNED_USER}/roles`,
      { roleIds: [superAdminRole.id] },
      { headers },
    )

    expect(result.status).toBe(403)
  })

  test('super admin can assign super admin role', async ({ expect }) => {
    const role = await accessControl.createRole({ name: 'SA2', features: grants('access-control.role.read') })
    await markSuperAdmin(role.id)

    const manageRole = await accessControl.createRole({
      name: 'SA Manager',
      features: grants('access-control.assignment.manage', 'access-control.assignment.read'),
    })
    await accessControl.assignRolesToUser('user_sa', [role.id, manageRole.id])
    const headers = authHeader('user', 'user_sa')

    const result = await replaceUserRoles(UNASSIGNED_USER, { roleIds: [role.id] }, headers)

    expect(result.status).toBe(200)
    expect(result.body.roles).toHaveLength(1)
    expect(result.body.roles[0]?.isSuperAdmin).toBe(true)
  })
})

test.describe('last super admin assignment protection via API', () => {
  test('cannot remove the last super admin assignment', async ({ expect }) => {
    const role = await accessControl.createRole({ name: 'SA Last', features: grants('access-control.role.read') })
    await markSuperAdmin(role.id)

    const manageRole = await accessControl.createRole({
      name: 'SA Manager 2',
      features: grants('access-control.assignment.manage', 'access-control.assignment.read'),
    })
    await accessControl.assignRolesToUser('user_sole_sa', [role.id, manageRole.id])
    const headers = authHeader('user', 'user_sole_sa')

    const result = await api.put<ApiErrorBody>('/admin/users/user_sole_sa/roles', { roleIds: [] }, { headers })

    expect(result.status).toBe(400)
  })
})

test.describe('GET /admin/users/:id/roles', () => {
  test("lists a user's assigned roles", async ({ expect }) => {
    const headers = authHeader('user', ADMIN_USER)
    const role = await accessControl.createRole({ name: 'Test Role', features: grants('product.read') })
    await accessControl.assignRolesToUser('user_target', [role.id])

    const { status, body } = await listUserRoles('user_target', headers)

    expect(status).toBe(200)
    expect(body.roles).toHaveLength(1)
    expect(body.roles[0]?.name).toBe('Test Role')
  })
})

test.describe('PUT /admin/users/:id/roles', () => {
  test("replaces a user's roles", async ({ expect }) => {
    const headers = authHeader('user', ADMIN_USER)
    const role1 = await accessControl.createRole({ name: 'Role A', features: grants('product.read') })
    const role2 = await accessControl.createRole({ name: 'Role B', features: grants('order.read') })
    await accessControl.assignRolesToUser('user_replace', [role1.id])

    const { status, body } = await replaceUserRoles('user_replace', { roleIds: [role2.id] }, headers)

    expect(status).toBe(200)
    expect(body.roles).toHaveLength(1)
    expect(body.roles[0]?.name).toBe('Role B')
  })

  test('400 when roleIds reference nonexistent roles', async ({ expect }) => {
    const headers = authHeader('user', ADMIN_USER)

    const result = await api.put<ApiErrorBody>(
      `/admin/users/${UNASSIGNED_USER}/roles`,
      { roleIds: ['role_nonexistent'] },
      { headers },
    )

    expect(result.status).toBe(404)
  })
})
