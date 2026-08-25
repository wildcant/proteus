import { generateResetJwtToken, getAuthJwtConfig } from '@core/auth/utils/generate-jwt-token.js'
import { AppError } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/auth/service.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import { Modules, NotificationTemplates } from '@core/utils/index.js'
import { createWorkflow } from '@core/workflows/types.js'
import { env } from '../../env.js'

export type RequestPasswordResetInput = {
  email: string
  actorType: string
  authProvider: string
}

export const requestPasswordResetWorkflow = createWorkflow<RequestPasswordResetInput, void>(
  'request-password-reset',
  async (ctx, input) => {
    const resetToken = await ctx.step<string | null>('create-reset-token', async ({ container }) => {
      const authService = container.resolve<IAuthModuleService>(Modules.AUTH)

      try {
        const result = await authService.createPasswordResetToken({
          provider: input.authProvider,
          entityId: input.email,
        })

        return generateResetJwtToken(
          {
            entityId: input.email,
            provider: input.authProvider,
            actorType: input.actorType,
            authIdentityId: result.providerIdentity.authIdentityId,
            jti: result.jti,
          },
          getAuthJwtConfig(),
        )
      } catch (error) {
        // Swallow NOT_FOUND to prevent email enumeration
        if (!AppError.isError(error)) throw error
        return null
      }
    })

    if (!resetToken) {
      return
    }

    await ctx.step('send-reset-email', async ({ container }) => {
      const notificationService = container.resolve<INotificationModuleService>(Modules.NOTIFICATION)
      const resetLink = `${env.STORE_URL}/reset-password?token=${resetToken}`
      await notificationService.createNotification({
        to: input.email,
        channel: 'email',
        template: NotificationTemplates.RESET_PASSWORD,
        data: { email: input.email, resetLink },
      })
    })
  },
)
