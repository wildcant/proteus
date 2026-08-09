import type { IUserModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminCreateInvite,
  AdminInviteListParams,
  AdminInviteListResponse,
  AdminInviteResponse,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '../../../server/ports.js'
import { createInviteWorkflow } from '../../../workflows/user/create-invite.js'

export const GetInput = { query: AdminInviteListParams }
export const GetOutput = AdminInviteListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const userService = req.scope.resolve<IUserModuleService>(Modules.USER)
  const { pagination, filters } = req.validatedQuery
  const [invites, count] = await userService.listAndCountInvites(filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { invites, count, offset, limit } }
}

export const PostInput = { body: AdminCreateInvite }
export const PostOutput = AdminInviteResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const invite = await createInviteWorkflow.run({ email: req.body.email })

  return { status: 201, json: { invite } }
}
