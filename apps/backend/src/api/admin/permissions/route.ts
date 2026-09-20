import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminPermissionListResponse } from '@proteus/http-schemas/admin'

export const GetOutput = AdminPermissionListResponse

export const GET = async (req: HttpRequest): Promise<HttpResult<typeof GetOutput>> => {
  const accessControl = req.scope.resolve(Modules.ACCESS_CONTROL)
  const permissions = await accessControl.listPermissions()
  return { status: 200, json: { permissions } }
}
