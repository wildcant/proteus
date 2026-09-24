import type { InviteDTO } from '@core/types/user/invite-common.js'
import { Modules } from '@core/utils/modules-definition.js'
import { NotificationTemplates } from '@core/utils/notification-templates.js'
import { createWorkflow } from '@core/workflows/types.js'
import { env } from '@env'

export type ResendInviteInput = {
  inviteId: string
}

export const resendInviteWorkflow = createWorkflow<ResendInviteInput, InviteDTO>(
  'resend-invite',
  async (ctx, input) => {
    const invite = await ctx.step<InviteDTO>('refresh-invite-token', async ({ container }) => {
      const userService = container.resolve(Modules.USER)
      return userService.refreshInviteToken(input.inviteId)
    })

    await ctx.step('send-invite-notification', async ({ container }) => {
      const notificationService = container.resolve(Modules.NOTIFICATION)
      const inviteLink = `${env.ADMIN_URL}/invite?token=${invite.token}`
      // TODO(i18n): the email goes out in English whatever the recipient's `user.locale`. Localize it
      // in a follow-up; the admin language picker does not change emails.
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
