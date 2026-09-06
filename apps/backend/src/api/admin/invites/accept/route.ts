import { AdminAcceptInvite, AdminAcceptInviteResponse } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { acceptInviteWorkflow } from '@workflows/user/accept-invite.js'

export const PostInput = { body: AdminAcceptInvite }
export const PostOutput = AdminAcceptInviteResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const user = await acceptInviteWorkflow.run({
    inviteToken: req.body.token,
    name: req.body.name,
    password: req.body.password,
  })

  return { status: 200, json: { user } }
}
