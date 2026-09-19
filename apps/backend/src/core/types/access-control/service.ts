import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type { PermissionGrant } from './common.js'
import type { CreateRoleDTO, PermissionDTO, RoleDTO, UpdateRoleDTO } from './dto.js'

export type IAccessControlModuleService = {
  createRole(data: CreateRoleDTO, context?: Context): Promise<RoleDTO>
  updateRole(roleId: string, data: UpdateRoleDTO, context?: Context): Promise<RoleDTO>
  deleteRole(roleId: string, context?: Context): Promise<void>
  retrieveRole(roleId: string, config?: FindConfig<RoleDTO>, context?: Context): Promise<RoleDTO>
  listRoles(config?: FindConfig<RoleDTO>, context?: Context): Promise<RoleDTO[]>
  listAndCountRoles(config?: FindConfig<RoleDTO>, context?: Context): Promise<[RoleDTO[], number]>

  listPermissions(config?: FindConfig<PermissionDTO>, context?: Context): Promise<PermissionDTO[]>
  retrievePermission(
    permissionId: string,
    config?: FindConfig<PermissionDTO>,
    context?: Context,
  ): Promise<PermissionDTO>
  syncPermissions(context?: Context): Promise<void>

  assignRoles(
    actorType: string,
    actorId: string,
    roleIds: string[],
    callerContext: { callerGrantsIncludeSuperAdmin: boolean },
    context?: Context,
  ): Promise<void>
  replaceRoles(
    actorType: string,
    actorId: string,
    roleIds: string[],
    callerContext: { callerGrantsIncludeSuperAdmin: boolean },
    context?: Context,
  ): Promise<void>
  listActorRoles(actorType: string, actorId: string, context?: Context): Promise<RoleDTO[]>
  listActorRolesBulk(actorType: string, actorIds: string[], context?: Context): Promise<Map<string, RoleDTO[]>>
  countRoleAssignments(roleId: string, context?: Context): Promise<number>

  assignRolesToUser(userId: string, roleIds: string[], context?: Context): Promise<void>
  removeRolesFromUser(userId: string, roleIds: string[], context?: Context): Promise<void>
  listUserRoles(userId: string, context?: Context): Promise<RoleDTO[]>
}
