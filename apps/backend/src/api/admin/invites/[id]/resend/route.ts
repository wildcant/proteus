import { AdminInviteResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { resendInviteWorkflow } from '@workflows/user/resend-invite.js'

export const PostInput = { params: IdParams }
export const PostOutput = AdminInviteResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const invite = await resendInviteWorkflow.run({ inviteId: req.params.id })
  return { status: 200, json: { invite } }
}
