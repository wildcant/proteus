import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/index.js'
import type { INotificationModuleService } from '@core/types/notification/service.js'
import { Modules } from '@core/utils/index.js'
import { authenticate } from '@framework/http/middlewares/authenticate.js'
import { VerificationRequestBody, VerificationRequestResponse } from '@proteus/http-schemas/auth'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { sendVerificationEmail } from '@workflows/auth/send-verification-email.js'

export const PostInput = { body: VerificationRequestBody }
export const PostMiddlewares = [authenticate('*', { allowUnregistered: true })] as const
export const PostOutput = VerificationRequestResponse

export const POST = async (
  req: HttpRequest<typeof PostInput, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const authContext = req.authContext
  if (!authContext) throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Unauthorized' })

  const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)

  const result = await authService.requestAuthVerification({
    authIdentityId: authContext.authIdentityId,
    entityId: req.body.entityId,
    entityType: req.body.entityType,
    codeProvider: req.body.codeProvider,
    metadata: req.body.metadata,
  })

  if (result.code && req.body.entityType === 'email') {
    const notificationService = req.scope.resolve<INotificationModuleService>(Modules.NOTIFICATION)
    await sendVerificationEmail(notificationService, result.entityId, result.code)
  }

  return {
    status: 200,
    json: {
      id: result.id,
      entityId: result.entityId,
      entityType: result.entityType,
      requestedAt: result.requestedAt,
    },
  }
}
