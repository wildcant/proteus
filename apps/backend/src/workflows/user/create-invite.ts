import type { INotificationModuleService } from '@core/types/notification/service.js'
import type { InviteDTO } from '@core/types/user/invite-common.js'
import type { IUserModuleService } from '@core/types/user/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import { env } from '../../env.js'

export type CreateInviteInput = {
  email: string
}

export const createInviteWorkflow = createWorkflow<CreateInviteInput, InviteDTO>(
  'create-invite',
  async (ctx, input) => {
    const invite = await ctx.step<InviteDTO>('create-invite', async ({ container }) => {
      const userService = container.resolve<IUserModuleService>(Modules.USER)
      return userService.createInvite({ email: input.email })
    })

    await ctx.step('send-invite-notification', async ({ container }) => {
      const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
      const inviteLink = `${env.ADMIN_URL}/invite?token=${invite.token}`
      await notificationService.createNotification({
        to: invite.email,
        channel: 'email',
        template: 'admin-invitation',
        data: { email: invite.email, inviteLink },
      })
    })

    return invite
  },
)
