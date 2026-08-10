import { ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/auth/service.js'
import type { UserDTO } from '@core/types/user/common.js'
import type { IUserModuleService } from '@core/types/user/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'

export type AcceptInviteInput = {
  inviteToken: string
  name: string
  password: string
}

export const acceptInviteWorkflow = createWorkflow<AcceptInviteInput, UserDTO>('accept-invite', async (ctx, input) => {
  const invite = await ctx.step('validate-invite-token', async ({ container }) => {
    const userService = container.resolve<IUserModuleService>(Modules.USER)
    return userService.validateInviteToken(input.inviteToken)
  })

  const authIdentity = await ctx.step(
    'register-auth-identity',
    async ({ container }) => {
      const authService = container.resolve<IAuthModuleService>(Modules.AUTH)

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
          message: result.error ?? 'Failed to register auth identity',
        })
      }

      return result.authIdentity
    },
    async (createdIdentity, { container }) => {
      const authService = container.resolve<IAuthModuleService>(Modules.AUTH)
      await authService.softDeleteAuthIdentities([createdIdentity.id])
    },
  )

  const user = await ctx.step<UserDTO>(
    'create-user',
    async ({ container }) => {
      const userService = container.resolve<IUserModuleService>(Modules.USER)
      return userService.createUser({ email: invite.email, name: input.name })
    },
    async (createdUser, { container }) => {
      const userService = container.resolve<IUserModuleService>(Modules.USER)
      await userService.softDeleteUsers([createdUser.id])
    },
  )

  await ctx.step<{ authIdentityId: string; previousMetadata: Record<string, unknown> | null }>(
    'set-auth-app-metadata',
    async ({ container }) => {
      const authService = container.resolve<IAuthModuleService>(Modules.AUTH)
      const identity = await authService.retrieveAuthIdentity(authIdentity.id)

      const previousMetadata = identity.appMetadata ? { ...identity.appMetadata } : null
      const currentValue = identity.appMetadata?.userId

      if (currentValue != null) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.CONFLICT,
          message: `Auth identity "${authIdentity.id}" already has "userId" set`,
        })
      }

      const updatedMetadata = { ...(identity.appMetadata ?? {}), userId: user.id }
      await authService.updateAuthIdentity(authIdentity.id, { appMetadata: updatedMetadata })

      return { authIdentityId: authIdentity.id, previousMetadata }
    },
    async ({ authIdentityId, previousMetadata }, { container }) => {
      const authService = container.resolve<IAuthModuleService>(Modules.AUTH)
      await authService.updateAuthIdentity(authIdentityId, { appMetadata: previousMetadata })
    },
  )

  await ctx.step('finalize-invite', async ({ container }) => {
    const userService = container.resolve<IUserModuleService>(Modules.USER)
    await userService.updateInvites([invite.id], { accepted: true })
  })

  return user
})
