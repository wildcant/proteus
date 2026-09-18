import type { IAccessControlModuleService } from '@core/types/access-control/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminPermissionResponse, IdParams } from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams }
export const GetOutput = AdminPermissionResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const accessControl = req.scope.resolve<IAccessControlModuleService>(Modules.ACCESS_CONTROL)
  const permission = await accessControl.retrievePermission(req.params.id)
  return { status: 200, json: { permission } }
}
