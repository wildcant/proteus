import type { IUserModuleService } from '@core/types/user/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminUpdateUser, AdminUserResponse, DeleteResponse, IdParams } from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams }
export const GetOutput = AdminUserResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const userService = req.scope.resolve<IUserModuleService>(Modules.USER)
  const user = await userService.retrieveUser(req.params.id)
  return { status: 200, json: { user } }
}

export const PatchInput = { params: IdParams, body: AdminUpdateUser }
export const PatchOutput = AdminUserResponse

export const PATCH = async (req: HttpRequest<typeof PatchInput>): Promise<HttpResult<typeof PatchOutput>> => {
  const userService = req.scope.resolve<IUserModuleService>(Modules.USER)
  const user = await userService.updateUser(req.params.id, req.body)
  return { status: 200, json: { user } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const userService = req.scope.resolve<IUserModuleService>(Modules.USER)
  await userService.softDeleteUsers([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
