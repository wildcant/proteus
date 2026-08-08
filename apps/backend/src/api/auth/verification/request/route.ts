import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService, Logger } from '@core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { VerificationRequestBody, VerificationRequestResponse } from '@proteus/http-schemas/auth'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'

export const PostInput = { body: VerificationRequestBody }
export const PostOutput = VerificationRequestResponse

export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const logger = req.scope.resolve<Logger>(ContainerRegistrationKeys.LOGGER)
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

  // TODO(notification): send the verification code to the user via email
  logger.debug(`Verification code for ${result.entityId}: ${result.code}`)

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
