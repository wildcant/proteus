import type { INotificationModuleService } from '@core/types/notification/service.js'
import type { InviteDTO } from '@core/types/user/invite-common.js'
import type { IUserModuleService } from '@core/types/user/service.js'
import { Modules, NotificationTemplates } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import { env } from '../../env.js'

export type ResendInviteInput = {
  inviteId: string
}

export const resendInviteWorkflow = createWorkflow<ResendInviteInput, InviteDTO>(
  'resend-invite',
  async (ctx, input) => {
    const invite = await ctx.step<InviteDTO>('refresh-invite-token', async ({ container }) => {
      const userService = container.resolve<IUserModuleService>(Modules.USER)
      return userService.refreshInviteToken(input.inviteId)
    })

    await ctx.step('send-invite-notification', async ({ container }) => {
      const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
      const inviteLink = `${env.ADMIN_URL}/invite?token=${invite.token}`
      await notificationService.createNotification({
        to: invite.email,
        channel: 'email',
        template: NotificationTemplates.ADMIN_INVITATION,
        data: { email: invite.email, inviteLink },
      })
    })

    return invite
  },
)
