import type { PermissionGrant } from '@core/types/access-control/common.js'
import type { IAccessControlModuleService } from '@core/types/access-control/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminCreateRole, AdminRoleListResponse, AdminRoleResponse } from '@proteus/http-schemas/admin'

export const GetOutput = AdminRoleListResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const accessControl = req.scope.resolve<IAccessControlModuleService>(Modules.ACCESS_CONTROL)
  const roles = await accessControl.listRoles()
  const rolesWithCounts = await Promise.all(
    roles.map(async (role) => ({
      ...role,
      userCount: await accessControl.countRoleAssignments(role.id),
    })),
  )
  return { status: 200, json: { roles: rolesWithCounts } }
}

export const PostInput = { body: AdminCreateRole }
export const PostOutput = AdminRoleResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const accessControl = req.scope.resolve<IAccessControlModuleService>(Modules.ACCESS_CONTROL)
  const role = await accessControl.createRole({
    ...req.body,
    features: req.body.features as PermissionGrant[],
  })
  return { status: 201, json: { role } }
}
