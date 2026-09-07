import type { IUserModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import {
  AdminCreateUser,
  AdminUserListParams,
  AdminUserListResponse,
  AdminUserResponse,
} from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const GetInput = { query: AdminUserListParams }
export const GetOutput = AdminUserListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const userService = req.scope.resolve<IUserModuleService>(Modules.USER)
  const { pagination, filters } = req.validatedQuery
  const [users, count] = await userService.listAndCountUsers(filters, pagination)
  const { offset, limit } = pagination
  return { status: 200, json: { users, count, offset, limit } }
}

export const PostInput = { body: AdminCreateUser }
export const PostOutput = AdminUserResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const userService = req.scope.resolve<IUserModuleService>(Modules.USER)
  const user = await userService.createUser(req.body)
  return { status: 201, json: { user } }
}
