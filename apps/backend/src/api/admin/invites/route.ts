import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import {
  AdminCreateInvite,
  AdminInviteListParams,
  AdminInviteListResponse,
  AdminInviteResponse,
} from '@proteus/http-schemas/admin'
import { createInviteWorkflow } from '@workflows/user/create-invite.js'

export const GetInput = { query: AdminInviteListParams }
export const GetOutput = AdminInviteListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const userService = req.scope.resolve(Modules.USER)
  const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK)
  const { pagination, filters } = req.validatedQuery
  const [invites, count] = await userService.listAndCountInvites(filters, pagination)
  const { offset, limit } = pagination

  const inviteIds = invites.map((i) => i.id)
  const inviteRoleLinks = await linkService.repo('inviteRole').findByInviteIds(inviteIds)
  const roleIdsByInvite = new Map<string, string[]>()
  for (const link of inviteRoleLinks) {
    const existing = roleIdsByInvite.get(link.inviteId) ?? []
    existing.push(link.roleId)
    roleIdsByInvite.set(link.inviteId, existing)
  }

  const enrichedInvites = invites.map((invite) => ({
    ...invite,
    roleIds: roleIdsByInvite.get(invite.id) ?? [],
  }))

  return { status: 200, json: { invites: enrichedInvites, count, offset, limit } }
}

export const PostInput = { body: AdminCreateInvite }
export const PostOutput = AdminInviteResponse
export const PostThrows = [...createInviteWorkflow.throws] as const

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const invite = await createInviteWorkflow.run({ email: req.body.email, roleIds: req.body.roleIds })

  return { status: 201, json: { invite: { ...invite, roleIds: req.body.roleIds ?? [] } } }
}
