import type { IUserModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AdminInviteResponse, DeleteResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { params: IdParams }
export const GetOutput = AdminInviteResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const userService = req.scope.resolve<IUserModuleService>(Modules.USER)
  const invite = await userService.retrieveInvite(req.params.id)
  return { status: 200, json: { invite } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const userService = req.scope.resolve<IUserModuleService>(Modules.USER)
  await userService.softDeleteInvites([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
