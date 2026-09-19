import { authorizeFeatures, resolveEffectiveFeatures } from '../../../core/access-control/engine.js'
import { getRegisteredFeatures } from '../../../core/access-control/features.js'
import type { AuthorizationContext, AuthorizationDecision } from '../../../core/access-control/types.js'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { PermissionGrant, PermissionKey } from '../../../core/types/access-control/common.js'
import type { CreateRoleDTO, PermissionDTO, RoleDTO, UpdateRoleDTO } from '../../../core/types/access-control/dto.js'
import type { IAccessControlModuleService } from '../../../core/types/access-control/service.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
import type { Logger } from '../../../core/types/logger.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { Permission } from '../models/permission.js'
import type { Role } from '../models/role.js'
import type { ActorRoleAssignmentRepository } from '../repositories/actor-role-assignment.js'
import type { PermissionRepository } from '../repositories/permission.js'
import type { RoleRepository } from '../repositories/role.js'

type InjectedDependencies = {
  permissionRepository: PermissionRepository
  roleRepository: RoleRepository
  actorRoleAssignmentRepository: ActorRoleAssignmentRepository
  withTransaction: WithTransaction
  logger: Logger
}

export class AccessControlModuleService implements IAccessControlModuleService {
  private permissionRepository: PermissionRepository
  private roleRepository: RoleRepository
  private actorRoleAssignmentRepository: ActorRoleAssignmentRepository
  private withTransaction: WithTransaction
  private logger: Logger

  constructor(dependencies: InjectedDependencies) {
    this.permissionRepository = dependencies.permissionRepository
    this.roleRepository = dependencies.roleRepository
    this.actorRoleAssignmentRepository = dependencies.actorRoleAssignmentRepository
    this.withTransaction = dependencies.withTransaction
    this.logger = dependencies.logger
  }

  // ── Authorization ────────────────────────────────────────────────────

  async authorize(required: PermissionKey[], subject: AuthorizationContext): Promise<AuthorizationDecision> {
    return authorizeFeatures(required, subject)
  }

  async authorizeOrThrow(required: PermissionKey[], subject: AuthorizationContext): Promise<void> {
    const decision = authorizeFeatures(required, subject)
    if (!decision.allowed) {
      throw new AppError({
        type: ErrorTypes.FORBIDDEN,
        message: `Missing permissions: ${decision.missing.join(', ')}`,
      })
    }
  }

  async scope(): Promise<undefined> {
    return undefined
  }

  async fields(): Promise<{ readable: '*'; writable: '*'; filterable: '*'; sortable: '*' }> {
    return { readable: '*', writable: '*', filterable: '*', sortable: '*' }
  }

  // ── Roles ────────────────────────────────────────────────────────────

  async createRole(data: CreateRoleDTO, context?: Context): Promise<RoleDTO> {
    this.validateFeatureIds(data.features)
    const role = await this.roleRepository.create(
      { name: data.name, description: data.description ?? null, featuresJson: data.features },
      context,
    )
    return this.toRoleDTO(role)
  }

  async updateRole(roleId: string, data: UpdateRoleDTO, context?: Context): Promise<RoleDTO> {
    return this.withTransaction(context, async (ctx) => {
      const existing = await this.roleRepository.findByIdOrFail(roleId, undefined, ctx)

      if (existing.isSuperAdmin) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: 'Super admin role cannot be modified',
        })
      }

      if (existing.protected) {
        if (data.name !== undefined && data.name !== existing.name) {
          throw new AppError({
            type: ErrorTypes.NOT_ALLOWED,
            message: 'Protected role cannot be renamed',
          })
        }
      }

      if (data.features) {
        this.validateFeatureIds(data.features)
      }

      const updates: Record<string, unknown> = {}
      if (data.name !== undefined) updates.name = data.name
      if (data.description !== undefined) updates.description = data.description
      if (data.features !== undefined) updates.featuresJson = data.features

      if (Object.keys(updates).length === 0) return this.toRoleDTO(existing)

      const updated = await this.roleRepository.update(roleId, updates, ctx)
      return this.toRoleDTO(updated)
    })
  }

  async deleteRole(roleId: string, context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      const role = await this.roleRepository.findByIdOrFail(roleId, undefined, ctx)

      if (role.isSuperAdmin || role.protected) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: 'Protected role cannot be deleted',
        })
      }

      const assignments = await this.actorRoleAssignmentRepository.find({ roleId }, undefined, ctx)
      if (assignments.length > 0) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Role is assigned to ${assignments.length} user(s). Remove assignments before deleting.`,
        })
      }

      await this.roleRepository.softDelete([roleId], ctx)
    })
  }

  async retrieveRole(roleId: string, config?: FindConfig<RoleDTO>, context?: Context): Promise<RoleDTO> {
    const role = await this.roleRepository.findByIdOrFail(roleId, this.toRoleFindConfig(config), context)
    return this.toRoleDTO(role)
  }

  async listRoles(config?: FindConfig<RoleDTO>, context?: Context): Promise<RoleDTO[]> {
    const roles = await this.roleRepository.find(undefined, this.toRoleFindConfig(config), context)
    return roles.map((r) => this.toRoleDTO(r))
  }

  async listAndCountRoles(config?: FindConfig<RoleDTO>, context?: Context): Promise<[RoleDTO[], number]> {
    const [roles, count] = await this.roleRepository.findAndCount(undefined, this.toRoleFindConfig(config), context)
    return [roles.map((r) => this.toRoleDTO(r)), count]
  }

  // ── Permissions ──────────────────────────────────────────────────────

  async listPermissions(config?: FindConfig<PermissionDTO>, context?: Context): Promise<PermissionDTO[]> {
    const rows = await this.permissionRepository.find(undefined, config, context)
    return rows.map((r) => this.toPermissionDTO(r))
  }

  async retrievePermission(
    permissionId: string,
    config?: FindConfig<PermissionDTO>,
    context?: Context,
  ): Promise<PermissionDTO> {
    const row = await this.permissionRepository.findByIdOrFail(permissionId, config, context)
    return this.toPermissionDTO(row)
  }

  // ── Assignments ──────────────────────────────────────────────────────

  async assignRoles(
    actorType: string,
    actorId: string,
    roleIds: string[],
    callerContext: { callerGrantsIncludeSuperAdmin: boolean },
    context?: Context,
  ): Promise<void> {
    if (roleIds.length === 0) return

    return this.withTransaction(context, async (ctx) => {
      const roles = await this.roleRepository.find({ id: roleIds }, undefined, ctx)
      if (roles.length !== roleIds.length) {
        const found = new Set(roles.map((r) => r.id))
        const missing = roleIds.filter((id) => !found.has(id))
        throw new AppError({
          type: ErrorTypes.NOT_FOUND,
          message: `Roles not found: ${missing.join(', ')}`,
        })
      }

      const hasSuperAdminRole = roles.some((r) => r.isSuperAdmin)
      if (hasSuperAdminRole && !callerContext.callerGrantsIncludeSuperAdmin) {
        throw new AppError({
          type: ErrorTypes.FORBIDDEN,
          message: 'Assigning super admin role requires caller to hold super admin',
        })
      }

      const existing = await this.actorRoleAssignmentRepository.find({ actorType, actorId }, undefined, ctx)
      const existingRoleIds = new Set(existing.map((a) => a.roleId))
      const newRoleIds = roleIds.filter((id) => !existingRoleIds.has(id))

      if (newRoleIds.length > 0) {
        await this.actorRoleAssignmentRepository.createMany(
          newRoleIds.map((roleId) => ({ actorType, actorId, roleId })),
          ctx,
        )
      }
    })
  }

  async revokeRoles(actorType: string, actorId: string, roleIds: string[], context?: Context): Promise<void> {
    if (roleIds.length === 0) return

    return this.withTransaction(context, async (ctx) => {
      await this.guardLastSuperAdmin(actorType, actorId, roleIds, ctx)

      const assignments = await this.actorRoleAssignmentRepository.find({ actorType, actorId }, undefined, ctx)
      const toRemove = assignments.filter((a) => roleIds.includes(a.roleId))
      if (toRemove.length > 0) {
        await this.actorRoleAssignmentRepository.softDelete(
          toRemove.map((a) => a.id),
          ctx,
        )
      }
    })
  }

  async replaceRoles(
    actorType: string,
    actorId: string,
    roleIds: string[],
    callerContext: { callerGrantsIncludeSuperAdmin: boolean },
    context?: Context,
  ): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      const roles = roleIds.length > 0 ? await this.roleRepository.find({ id: roleIds }, undefined, ctx) : []
      if (roles.length !== roleIds.length) {
        const found = new Set(roles.map((r) => r.id))
        const missing = roleIds.filter((id) => !found.has(id))
        throw new AppError({
          type: ErrorTypes.NOT_FOUND,
          message: `Roles not found: ${missing.join(', ')}`,
        })
      }

      const hasSuperAdminRole = roles.some((r) => r.isSuperAdmin)
      if (hasSuperAdminRole && !callerContext.callerGrantsIncludeSuperAdmin) {
        throw new AppError({
          type: ErrorTypes.FORBIDDEN,
          message: 'Assigning super admin role requires caller to hold super admin',
        })
      }

      const existing = await this.actorRoleAssignmentRepository.find({ actorType, actorId }, undefined, ctx)
      const existingRoleIds = existing.map((a) => a.roleId)

      const removedRoleIds = existingRoleIds.filter((id) => !roleIds.includes(id))
      if (removedRoleIds.length > 0) {
        await this.guardLastSuperAdmin(actorType, actorId, removedRoleIds, ctx)
      }

      const toRemove = existing.filter((a) => !roleIds.includes(a.roleId))
      if (toRemove.length > 0) {
        await this.actorRoleAssignmentRepository.softDelete(
          toRemove.map((a) => a.id),
          ctx,
        )
      }

      const existingSet = new Set(existingRoleIds)
      const toAdd = roleIds.filter((id) => !existingSet.has(id))
      if (toAdd.length > 0) {
        await this.actorRoleAssignmentRepository.createMany(
          toAdd.map((roleId) => ({ actorType, actorId, roleId })),
          ctx,
        )
      }
    })
  }

  async countRoleAssignments(roleId: string, context?: Context): Promise<number> {
    const assignments = await this.actorRoleAssignmentRepository.find({ roleId }, undefined, context)
    return assignments.length
  }

  async listActorRoles(actorType: string, actorId: string, context?: Context): Promise<RoleDTO[]> {
    const assignments = await this.actorRoleAssignmentRepository.find({ actorType, actorId }, undefined, context)
    if (assignments.length === 0) return []

    const roles = await this.roleRepository.find({ id: assignments.map((a) => a.roleId) }, undefined, context)
    return roles.map((r) => this.toRoleDTO(r))
  }

  async listActorRolesBulk(actorType: string, actorIds: string[], context?: Context): Promise<Map<string, RoleDTO[]>> {
    const result = new Map<string, RoleDTO[]>(actorIds.map((id) => [id, []]))
    if (actorIds.length === 0) return result

    const assignments = await this.actorRoleAssignmentRepository.find(
      { actorType, actorId: actorIds },
      undefined,
      context,
    )
    if (assignments.length === 0) return result

    const roleIds = [...new Set(assignments.map((a) => a.roleId))]
    const roles = await this.roleRepository.find({ id: roleIds }, undefined, context)
    const roleMap = new Map(roles.map((r) => [r.id, this.toRoleDTO(r)]))

    for (const assignment of assignments) {
      const role = roleMap.get(assignment.roleId)
      if (role) {
        result.get(assignment.actorId)?.push(role)
      }
    }

    return result
  }

  // ── IAccessControlModuleService compat ───────────────────────────────

  async assignRolesToUser(userId: string, roleIds: string[], context?: Context): Promise<void> {
    return this.assignRoles('user', userId, roleIds, { callerGrantsIncludeSuperAdmin: true }, context)
  }

  async removeRolesFromUser(userId: string, roleIds: string[], context?: Context): Promise<void> {
    return this.revokeRoles('user', userId, roleIds, context)
  }

  async listUserRoles(userId: string, context?: Context): Promise<RoleDTO[]> {
    return this.listActorRoles('user', userId, context)
  }

  async listGrantedPermissionKeys(actorType: string, actorId: string, context?: Context): Promise<string[]> {
    return this.resolveEffectiveFeatures(actorType, actorId, context)
  }

  // ── Resolution ───────────────────────────────────────────────────────

  async resolvePermissions(actorType: string, actorId: string, context?: Context): Promise<PermissionGrant[]> {
    const roles = await this.listActorRoles(actorType, actorId, context)
    const grants = new Set<PermissionGrant>()
    for (const role of roles) {
      for (const feature of role.features) {
        grants.add(feature)
      }
    }
    return [...grants]
  }

  async resolveEffectiveFeatures(actorType: string, actorId: string, context?: Context): Promise<PermissionKey[]> {
    const grants = await this.resolvePermissions(actorType, actorId, context)
    return resolveEffectiveFeatures(grants)
  }

  // ── Sync ─────────────────────────────────────────────────────────────

  async syncPermissions(context?: Context): Promise<void> {
    const registered = getRegisteredFeatures()
    const now = new Date()

    return this.withTransaction(context, async (ctx) => {
      const existing = await this.permissionRepository.find(undefined, { withDeleted: true }, ctx)
      const byKey = new Map(existing.map((p) => [p.key, p]))

      const toCreate: Array<{ key: string; module: string; title: string; registeredAt: Date }> = []
      const toUpdate: Array<{ id: string; title: string; registeredAt: Date }> = []
      const toRestore: string[] = []
      const registeredKeys = new Set<string>()

      for (const [key, declaration] of registered) {
        registeredKeys.add(key)
        const row = byKey.get(key)
        if (!row) {
          toCreate.push({ key, module: declaration.module, title: declaration.title, registeredAt: now })
        } else {
          if (row.deletedAt) {
            toRestore.push(row.id)
          }
          if (row.title !== declaration.title || !row.registeredAt || row.module !== declaration.module) {
            toUpdate.push({ id: row.id, title: declaration.title, registeredAt: now })
          }
        }
      }

      const unregistered = existing.filter((p) => !registeredKeys.has(p.key) && !p.deletedAt)
      const assignedUnregistered: string[] = []
      const toSoftDelete: string[] = []

      for (const perm of unregistered) {
        const assignments = await this.findRolesReferencingPermission(perm.key as PermissionKey, ctx)
        if (assignments.length > 0) {
          assignedUnregistered.push(perm.key)
        } else {
          toSoftDelete.push(perm.id)
        }
      }

      if (assignedUnregistered.length > 0) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Cannot remove permissions still assigned to roles: ${assignedUnregistered.join(', ')}`,
        })
      }

      if (toRestore.length > 0) {
        await this.permissionRepository.restore(toRestore, ctx)
      }

      if (toCreate.length > 0) {
        await this.permissionRepository.createMany(toCreate, ctx)
      }

      for (const update of toUpdate) {
        await this.permissionRepository.update(
          update.id,
          { title: update.title, registeredAt: update.registeredAt },
          ctx,
        )
      }

      if (toSoftDelete.length > 0) {
        await this.permissionRepository.softDelete(toSoftDelete, ctx)
      }

      this.logger.debug(
        `Synced permissions: ${toCreate.length} created, ${toUpdate.length} updated, ${toSoftDelete.length} removed, ${toRestore.length} restored`,
      )
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private async guardLastSuperAdmin(
    actorType: string,
    actorId: string,
    roleIdsToRemove: string[],
    context: Context,
  ): Promise<void> {
    const roles = await this.roleRepository.find({ id: roleIdsToRemove }, undefined, context)
    const removingSuperAdmin = roles.some((r) => r.isSuperAdmin)
    if (!removingSuperAdmin) return

    const allSuperAdminAssignments = await this.findSuperAdminAssignments(context)
    const remainingAfterRemoval = allSuperAdminAssignments.filter(
      (a) => !(a.actorType === actorType && a.actorId === actorId),
    )

    if (remainingAfterRemoval.length === 0) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: 'Cannot revoke the last super admin assignment',
      })
    }
  }

  private async findSuperAdminAssignments(context: Context) {
    const superAdminRoles = await this.roleRepository.find({ isSuperAdmin: true }, undefined, context)
    if (superAdminRoles.length === 0) return []

    const assignments = await this.actorRoleAssignmentRepository.find(
      { roleId: superAdminRoles.map((r) => r.id) },
      undefined,
      context,
    )
    return assignments
  }

  private async findRolesReferencingPermission(key: PermissionKey, context: Context): Promise<Role[]> {
    const allRoles = await this.roleRepository.find(undefined, undefined, context)
    return allRoles.filter((role) => {
      return role.featuresJson.some((grant) => {
        if (grant === key) return true
        if (grant === '*') return true
        if (grant.endsWith('.*')) {
          return key.startsWith(grant.slice(0, -1))
        }
        return false
      })
    })
  }

  private validateFeatureIds(features: PermissionGrant[]): void {
    const seen = new Set<PermissionGrant>()
    for (const feature of features) {
      if (seen.has(feature)) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Duplicate feature id: ${feature}`,
        })
      }
      seen.add(feature)
    }

    const registered = getRegisteredFeatures()
    const moduleIds = new Set<string>()
    for (const declaration of registered.values()) {
      moduleIds.add(declaration.module)
    }

    for (const grant of features) {
      if (grant === '*') {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: 'Global wildcard grant is reserved for the super admin role',
        })
      }

      if (grant.endsWith('.*')) {
        const module = grant.slice(0, -2)
        if (!moduleIds.has(module)) {
          throw new AppError({
            type: ErrorTypes.INVALID_DATA,
            message: `Unknown module wildcard: ${grant}`,
          })
        }
        continue
      }

      if (!registered.has(grant as PermissionKey)) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `Unknown permission key: ${grant}`,
        })
      }
    }
  }

  private static readonly DTO_TO_ENTITY_KEY: Record<string, string> = {
    features: 'featuresJson',
    isImmutable: 'protected',
  }

  private toRoleFindConfig(config?: FindConfig<RoleDTO>): FindConfig<Role> | undefined {
    if (!config) return undefined
    const mapped: FindConfig<Role> = { ...config, select: undefined, order: undefined }
    if (config.select) {
      mapped.select = config.select.map(
        (k) => (AccessControlModuleService.DTO_TO_ENTITY_KEY[k as string] ?? k) as keyof Role,
      )
    }
    if (config.order) {
      mapped.order = Object.fromEntries(
        Object.entries(config.order).map(([k, v]) => [AccessControlModuleService.DTO_TO_ENTITY_KEY[k] ?? k, v]),
      ) as FindConfig<Role>['order']
    }
    return mapped
  }

  private toRoleDTO(role: Role): RoleDTO {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      features: role.featuresJson as PermissionGrant[],
      isSuperAdmin: role.isSuperAdmin,
      protected: role.protected,
      isImmutable: role.protected || role.isSuperAdmin,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      deletedAt: role.deletedAt,
    }
  }

  private toPermissionDTO(permission: Permission): PermissionDTO {
    return {
      id: permission.id,
      key: permission.key as PermissionKey,
      module: permission.module,
      title: permission.title,
      description: permission.description,
      assignable: permission.assignable,
      registeredAt: permission.registeredAt,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
      deletedAt: permission.deletedAt,
    }
  }
}
