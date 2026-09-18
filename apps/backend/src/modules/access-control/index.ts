import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { syncPermissions } from './loaders/sync-permissions.js'
import { actorRoleAssignmentTable } from './models/actor-role-assignment.js'
import { permissionTable } from './models/permission.js'
import { roleTable } from './models/role.js'
import { ActorRoleAssignmentRepository } from './repositories/actor-role-assignment.js'
import { PermissionRepository } from './repositories/permission.js'
import { RoleRepository } from './repositories/role.js'
import { AccessControlModuleService } from './services/access-control-module-service.js'

export default Module(Modules.ACCESS_CONTROL, {
  service: AccessControlModuleService,
  features: [
    { id: 'access-control.role.read', title: 'View roles' },
    { id: 'access-control.role.manage', title: 'Manage roles' },
    { id: 'access-control.assignment.read', title: 'View role assignments' },
    { id: 'access-control.assignment.manage', title: 'Manage role assignments' },
  ],
  models: {
    actorRoleAssignmentTable,
    permissionTable,
    roleTable,
  },
  repositories: {
    actorRoleAssignmentRepository: ActorRoleAssignmentRepository,
    permissionRepository: PermissionRepository,
    roleRepository: RoleRepository,
  },
  loaders: [syncPermissions],
})
