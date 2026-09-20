import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminInviteResponse, DeleteResponse, IdParams } from '@proteus/http-schemas/admin'

export const GetInput = { params: IdParams }
export const GetOutput = AdminInviteResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const userService = req.scope.resolve(Modules.USER)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const invite = await userService.retrieveInvite(req.params.id)
  const inviteRoleLinks = await linkService.repo('inviteRole').findByInviteId(invite.id)
  return { status: 200, json: { invite: { ...invite, roleIds: inviteRoleLinks.map((l) => l.roleId) } } }
}

export const DeleteInput = { params: IdParams }
export const DeleteOutput = DeleteResponse

export const DELETE = async (req: HttpRequest<typeof DeleteInput>): Promise<HttpResult<typeof DeleteOutput>> => {
  const userService = req.scope.resolve(Modules.USER)
  await userService.softDeleteInvites([req.params.id])
  return { status: 200, json: { id: req.params.id, deleted: true } }
}
