import { buildCascadeGraph } from '../../core/db/cascade-graph.js'
import { noopLogger } from '../../core/logger/noop-logger.js'
import { createWithTransaction } from '../../core/utils/with-transaction.js'
import type { Database } from '../../schema.type.js'
import { actorRoleAssignmentTable } from './models/actor-role-assignment.js'
import { permissionTable } from './models/permission.js'
import { roleTable } from './models/role.js'
import { ActorRoleAssignmentRepository } from './repositories/actor-role-assignment.js'
import { PermissionRepository } from './repositories/permission.js'
import { RoleRepository } from './repositories/role.js'
import { AccessControlModuleService } from './services/access-control-module-service.js'

const cascadeGraph = buildCascadeGraph({
  actorRoleAssignmentTable,
  permissionTable,
  roleTable,
})

/** Syncs the declared feature catalogue to the database. Used out-of-band for workerd deployments. */
export async function syncPermissions(getDb: () => Database) {
  const service = new AccessControlModuleService({
    permissionRepository: new PermissionRepository({ getDb, cascadeGraph }),
    roleRepository: new RoleRepository({ getDb, cascadeGraph }),
    actorRoleAssignmentRepository: new ActorRoleAssignmentRepository({ getDb, cascadeGraph }),
    withTransaction: createWithTransaction(getDb),
    logger: noopLogger,
  })
  await service.syncPermissions()
}
