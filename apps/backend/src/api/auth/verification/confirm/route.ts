import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { Modules } from '@core/utils/modules-definition.js'
import { authenticate } from '@framework/http/middlewares/authenticate.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { VerificationConfirmBody, VerificationConfirmResponse } from '@proteus/http-schemas/auth'
import { i18n } from '@proteus/utils'

export const PostInput = { body: VerificationConfirmBody }
export const PostMiddlewares = [authenticate('*', { allowUnregistered: true })] as const
export const PostOutput = VerificationConfirmResponse
export const PostThrows = [ErrorTypes.UNAUTHORIZED, ErrorTypes.UNEXPECTED_STATE] as const

export const POST = async (
  req: HttpRequest<typeof PostInput, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const authContext = req.authContext
  if (!authContext) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: i18n.t('Unauthorized') })
  }

  const authService = req.scope.resolve(Modules.AUTH)

  const result = await authService.confirmAuthVerification({
    authIdentityId: authContext.authIdentityId,
    codeProvider: req.body.codeProvider,
    code: req.body.code,
  })

  const verifiedAt = result.verifiedAt
  if (!verifiedAt) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: i18n.t('Expected verifiedAt to be set after confirmation'),
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
