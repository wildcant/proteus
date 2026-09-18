import type { PermissionRepository } from '../repositories/permission.js'
import type { RoleRepository } from '../repositories/role.js'
import type { ActorRoleAssignmentRepository } from '../repositories/actor-role-assignment.js'

type InjectedDependencies = {
  permissionRepository: PermissionRepository
  roleRepository: RoleRepository
  actorRoleAssignmentRepository: ActorRoleAssignmentRepository
}

export class AccessControlModuleService {
  private permissionRepository: PermissionRepository
  private roleRepository: RoleRepository
  private actorRoleAssignmentRepository: ActorRoleAssignmentRepository

  constructor({ permissionRepository, roleRepository, actorRoleAssignmentRepository }: InjectedDependencies) {
    this.permissionRepository = permissionRepository
    this.roleRepository = roleRepository
    this.actorRoleAssignmentRepository = actorRoleAssignmentRepository
  }
}
