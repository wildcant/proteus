import { ErrorTypes } from '@core/errors/app-error.js'
import type { UserDTO } from '@core/types/user/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n, type Msgid } from '@proteus/utils'
import { SOURCE_LOCALE } from '@workflows/admin/utils/admin-locales.js'

export type AcceptInviteInput = {
  inviteToken: string
  name: string
  password: string
}

export const acceptInviteWorkflow = createWorkflow<AcceptInviteInput, UserDTO>(
  { name: 'accept-invite', throws: [ErrorTypes.CONFLICT, ErrorTypes.INVALID_DATA] },
  async (ctx, input) => {
    const invite = await ctx.step('validate-invite-token', async ({ container }) => {
      const userService = container.resolve(Modules.USER)
      return userService.validateInviteToken(input.inviteToken)
    })

    const authIdentity = await ctx.step(
      'register-auth-identity',
      async ({ container }) => {
        const authService = container.resolve(Modules.AUTH)

        let result = await authService.register('emailpass', {
          body: { email: invite.email, password: input.password },
        })

        if (!result.success && result.error?.includes('already exists')) {
          result = await authService.authenticate('emailpass', {
            body: { email: invite.email, password: input.password },
          })
        }

        if (!result.success || !result.authIdentity) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.INVALID_DATA,
            // The provider's own reason is not in any catalog, so it answers in English.
            message: (result.error as Msgid | undefined) ?? i18n.t('Failed to register auth identity'),
          })
        }

        return result.authIdentity
      },
      async (createdIdentity, { container }) => {
        const authService = container.resolve(Modules.AUTH)
        await authService.softDeleteAuthIdentities([createdIdentity.id])
      },
    )

    const user = await ctx.step<UserDTO>(
      'create-user',
      async ({ container }) => {
        const userService = container.resolve(Modules.USER)
        return userService.createUser({ email: invite.email, name: input.name, locale: SOURCE_LOCALE })
      },
      async (createdUser, { container }) => {
        const userService = container.resolve(Modules.USER)
        await userService.softDeleteUsers([createdUser.id])
      },
    )

    await ctx.step<{ authIdentityId: string; previousMetadata: Record<string, unknown> | null }>(
      'set-auth-app-metadata',
      async ({ container }) => {
        const authService = container.resolve(Modules.AUTH)
        const identity = await authService.retrieveAuthIdentity(authIdentity.id)

        const previousMetadata = identity.appMetadata ? { ...identity.appMetadata } : null
        const currentValue = identity.appMetadata?.userId

        if (currentValue != null) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.CONFLICT,
            message: i18n.t('Auth identity "{authIdentityId}" already has "userId" set'),
            values: { authIdentityId: authIdentity.id },
          })
        }

        const updatedMetadata = { ...(identity.appMetadata ?? {}), userId: user.id }
        await authService.updateAuthIdentity(authIdentity.id, { appMetadata: updatedMetadata })

        return { authIdentityId: authIdentity.id, previousMetadata }
      },
      async ({ authIdentityId, previousMetadata }, { container }) => {
        const authService = container.resolve(Modules.AUTH)
        await authService.updateAuthIdentity(authIdentityId, { appMetadata: previousMetadata })
      },
    )

    await ctx.step('assign-invite-roles', async ({ container }) => {
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)
      const inviteRoleLinks = await linkService.repo('inviteRole').findByInviteId(invite.id)
      if (inviteRoleLinks.length === 0) return
      const accessControl = container.resolve(Modules.ACCESS_CONTROL)
      await accessControl.assignRolesToUser(
        user.id,
        inviteRoleLinks.map((link) => link.roleId),
      )
    })

    await ctx.step('finalize-invite', async ({ container }) => {
      const userService = container.resolve(Modules.USER)
      await userService.updateInvites([invite.id], { accepted: true })
    })

    return user
  },
)
