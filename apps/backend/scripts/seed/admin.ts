import type { IAuthModuleService } from '../../src/core/types/auth/service.js'
import type { IUserModuleService } from '../../src/core/types/user/service.js'
import type { AccessControlModuleService } from '../../src/modules/access-control/services/access-control-module-service.js'
import { SOURCE_LOCALE } from '../../src/workflows/admin/utils/admin-locales.js'

/**
 * An admin who can sign in and do everything: an emailpass identity, the user it signs in as, and
 * the super admin role. Each part is created only when missing, so a rerun finishes a half-made
 * admin instead of failing on the parts that exist.
 *
 * Shared by the development seed and `create-admin.ts`, which makes a deployment's first admin.
 */

type AdminSeedServices = {
  authService: IAuthModuleService
  userService: IUserModuleService
  accessControlService: AccessControlModuleService
}

type Admin = {
  /** Pinned by the development seed so its admin keeps one id across resets. */
  id?: string
  name: string
  email: string
  password: string
}

export async function seedAdmin(services: AdminSeedServices, admin: Admin) {
  const { authService, userService, accessControlService } = services

  const identities = await authService.listProviderIdentities({ entityId: admin.email, provider: 'emailpass' })
  if (identities.length === 0) {
    const registration = await authService.register('emailpass', {
      body: { email: admin.email, password: admin.password },
    })
    if (!registration.success || !registration.authIdentity) {
      throw new Error(`Failed to register ${admin.email}: ${registration.error}`)
    }
    console.info(`Registered ${admin.email}`)
  } else {
    console.info(`Skipped registering ${admin.email} (already registered)`)
  }

  const [identity] = await authService.listProviderIdentities({ entityId: admin.email, provider: 'emailpass' })
  if (!identity) throw new Error(`No emailpass identity for ${admin.email}`)

  const [existingUser] = await userService.listUsers({ email: admin.email })
  const user =
    existingUser ??
    (await userService.createUsers([{ id: admin.id, name: admin.name, email: admin.email, locale: SOURCE_LOCALE }]))[0]
  if (!user) throw new Error(`Failed to create the user for ${admin.email}`)

  const authIdentity = await authService.retrieveAuthIdentity(identity.authIdentityId)
  const appMetadata = (authIdentity.appMetadata as Record<string, unknown> | null) ?? {}
  if (appMetadata.userId !== user.id) {
    await authService.updateAuthIdentities([identity.authIdentityId], {
      appMetadata: { ...appMetadata, userId: user.id },
    })
    console.info(`Linked ${admin.email} to user ${user.id}`)
  }

  const roles = await accessControlService.listRoles()
  const superAdminRole = roles.find((role) => role.isSuperAdmin) ?? (await createSuperAdminRole(accessControlService))
  await accessControlService.assignRolesToUser(user.id, [superAdminRole.id])
  console.info(`Assigned the super admin role to ${admin.email}`)

  return user
}

async function createSuperAdminRole(accessControlService: AccessControlModuleService) {
  const role = await accessControlService.createRole({ name: 'Super Admin', features: [] })
  // createRole refuses '*' and updateRole refuses a super admin role, so the privileged fields can
  // only be set through the repository the service keeps private.
  type RoleRepository = { update(id: string, data: Record<string, unknown>): Promise<unknown> }
  const { roleRepository } = accessControlService as unknown as { roleRepository: RoleRepository }
  await roleRepository.update(role.id, { isSuperAdmin: true, protected: true, featuresJson: ['*'] })
  console.info('Created the super admin role')
  return role
}
