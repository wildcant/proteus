import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCreateUser,
  AdminUserListParams,
  AdminUserListResponse,
  AdminUserResponse,
} from '@proteus/http-schemas/admin'

export const GetInput = { query: AdminUserListParams }
export const GetOutput = AdminUserListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const userService = req.scope.resolve(Modules.USER)
  const accessControl = req.scope.resolve(Modules.ACCESS_CONTROL)
  const { pagination, filters } = req.validatedQuery
  const [users, count] = await userService.listAndCountUsers(filters, pagination)
  const { offset, limit } = pagination

  const rolesByUser = await accessControl.listActorRolesBulk(
    'user',
    users.map((u) => u.id),
  )
  const usersWithRoles = users.map((user) => ({
    ...user,
    roles: (rolesByUser.get(user.id) ?? []).map((r) => ({ id: r.id, name: r.name })),
  }))

  return { status: 200, json: { users: usersWithRoles, count, offset, limit } }
}

export const PostInput = { body: AdminCreateUser }
export const PostOutput = AdminUserResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const userService = req.scope.resolve(Modules.USER)
  const user = await userService.createUser(req.body)
  return { status: 201, json: { user } }
}
