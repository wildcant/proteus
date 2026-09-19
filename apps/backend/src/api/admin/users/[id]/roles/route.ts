import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IAccessControlModuleService } from '@core/types/access-control/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminReplaceUserRoles, AdminUserRolesResponse, IdParams } from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams }
export const GetOutput = AdminUserRolesResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const accessControl = req.scope.resolve<IAccessControlModuleService>(Modules.ACCESS_CONTROL)
  const roles = await accessControl.listActorRoles('user', req.params.id)
  return { status: 200, json: { roles } }
}

export const PutInput = { params: IdParams, body: AdminReplaceUserRoles }
export const PutOutput = AdminUserRolesResponse
// biome-ignore format: single line keeps ast-grep suppression working
// replaceRoles throws NOT_FOUND, FORBIDDEN (escalation), NOT_ALLOWED (last super admin)
// ast-grep-ignore: route-declares-unthrown-error
export const PutThrows = [ErrorTypes.UNAUTHORIZED, ErrorTypes.NOT_FOUND, ErrorTypes.FORBIDDEN, ErrorTypes.NOT_ALLOWED] as const

export const PUT = async (req: HttpRequest<typeof PutInput>): Promise<HttpResult<typeof PutOutput>> => {
  const accessControl = req.scope.resolve<IAccessControlModuleService>(Modules.ACCESS_CONTROL)
  const authContext = req.authContext
  if (!authContext) throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Unauthorized' })
  const callerId = authContext.actorId
  const callerRoles = await accessControl.listActorRoles('user', callerId)
  const callerGrantsIncludeSuperAdmin = callerRoles.some((r) => r.isSuperAdmin)
  await accessControl.replaceRoles('user', req.params.id, req.body.roleIds, { callerGrantsIncludeSuperAdmin })
  const roles = await accessControl.listActorRoles('user', req.params.id)
  return { status: 200, json: { roles } }
}
