import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type { CreateRoleDTO, RoleDTO, UpdateRoleDTO } from './dto.js'

export type IAccessControlModuleService = {
  createRole(data: CreateRoleDTO, context?: Context): Promise<RoleDTO>
  updateRole(roleId: string, data: UpdateRoleDTO, context?: Context): Promise<RoleDTO>
  deleteRole(roleId: string, context?: Context): Promise<void>
  retrieveRole(roleId: string, config?: FindConfig<RoleDTO>, context?: Context): Promise<RoleDTO>
  listRoles(config?: FindConfig<RoleDTO>, context?: Context): Promise<RoleDTO[]>
  listAndCountRoles(config?: FindConfig<RoleDTO>, context?: Context): Promise<[RoleDTO[], number]>

  assignRolesToUser(userId: string, roleIds: string[], context?: Context): Promise<void>
  removeRolesFromUser(userId: string, roleIds: string[], context?: Context): Promise<void>
  listUserRoles(userId: string, context?: Context): Promise<RoleDTO[]>
}
