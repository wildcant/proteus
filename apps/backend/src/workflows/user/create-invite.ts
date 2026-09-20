import type { InviteDTO } from '@core/types/user/invite-common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { NotificationTemplates } from '@core/utils/notification-templates.js'
import { createWorkflow } from '@core/workflows/types.js'
import { env } from '@env'

export type CreateInviteInput = {
  email: string
  roleIds?: string[]
}

export const createInviteWorkflow = createWorkflow<CreateInviteInput, InviteDTO>(
  'create-invite',
  async (ctx, input) => {
    const invite = await ctx.step<InviteDTO>('create-invite', async ({ container }) => {
      const userService = container.resolve(Modules.USER)
      return userService.createInvite({ email: input.email })
    })

    await ctx.step('link-invite-roles', async ({ container }) => {
      const roleIds = input.roleIds ?? []
      if (roleIds.length === 0) return
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)
      await linkService.repo('inviteRole').createMany(roleIds.map((roleId) => ({ inviteId: invite.id, roleId })))
    })

    await ctx.step('send-invite-notification', async ({ container }) => {
      const notificationService = container.resolve(Modules.NOTIFICATION)
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
