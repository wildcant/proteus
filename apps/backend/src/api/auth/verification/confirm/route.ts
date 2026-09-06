import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { authenticate } from '@framework/http/middlewares/authenticate.js'
import { VerificationConfirmBody, VerificationConfirmResponse } from '@proteus/http-schemas/auth'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'

export const PostInput = { body: VerificationConfirmBody }
export const PostMiddlewares = [authenticate('*', { allowUnregistered: true })] as const
export const PostOutput = VerificationConfirmResponse

export const POST = async (
  req: HttpRequest<typeof PostInput, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const authContext = req.authContext
  if (!authContext) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Unauthorized' })
  }

  const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)

  const result = await authService.confirmAuthVerification({
    authIdentityId: authContext.authIdentityId,
    codeProvider: req.body.codeProvider,
    code: req.body.code,
  })

  const verifiedAt = result.verifiedAt
  if (!verifiedAt) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: 'Expected verifiedAt to be set after confirmation',
    })
  }

  return {
    status: 200,
    json: {
      id: result.id,
      entityId: result.entityId,
      entityType: result.entityType,
      verifiedAt,
    },
  }
}
