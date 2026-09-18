import { ErrorTypes } from '@core/errors/app-error.js'
import type { PermissionGrant } from '@core/types/access-control/common.js'
import type { UpdateRoleDTO } from '@core/types/access-control/dto.js'
import type { IAccessControlModuleService } from '@core/types/access-control/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminRoleDetailResponse, AdminUpdateRole, DeleteResponse, IdParams } from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams }
export const GetOutput = AdminRoleDetailResponse
export const GetThrows = [ErrorTypes.NOT_FOUND] as const

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const accessControl = req.scope.resolve<IAccessControlModuleService>(Modules.ACCESS_CONTROL)
  const role = await accessControl.retrieveRole(req.params.id)
  const userCount = await accessControl.countRoleAssignments(req.params.id)
  return { status: 200, json: { role: { ...role, userCount } } }
}

export const PatchInput = { params: IdParams, body: AdminUpdateRole }
export const PatchOutput = AdminRoleDetailResponse
export const PatchThrows = [ErrorTypes.NOT_FOUND, ErrorTypes.NOT_ALLOWED, ErrorTypes.INVALID_DATA] as const

export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const accessControl = req.scope.resolve<IAccessControlModuleService>(Modules.ACCESS_CONTROL)
  const role = await accessControl.updateRole(req.params.id, {
    name: req.body.name,
    description: req.body.description,
    features: req.body.features as PermissionGrant[] | undefined,
  })
  const userCount = await accessControl.countRoleAssignments(req.params.id)
  return { status: 200, json: { role: { ...role, userCount } } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse
export const DeleteThrows = [ErrorTypes.NOT_FOUND, ErrorTypes.NOT_ALLOWED, ErrorTypes.INVALID_DATA] as const

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const accessControl = req.scope.resolve<IAccessControlModuleService>(Modules.ACCESS_CONTROL)
  await accessControl.deleteRole(req.params.id)
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
