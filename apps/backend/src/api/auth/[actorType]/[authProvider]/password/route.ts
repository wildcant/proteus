import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { validateScopeProviderAssociation } from '@framework/http/middlewares/validate-scope-provider-association.js'
import { validateToken } from '@framework/http/middlewares/validate-token.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AuthParams, UpdatePasswordBody, UpdatePasswordResponse } from '@proteus/http-schemas/auth'

export const PostInput = { body: UpdatePasswordBody, params: AuthParams }
export const PostMiddlewares = [validateScopeProviderAssociation(), validateToken()] as const
export const PostOutput = UpdatePasswordResponse
export const PostThrows = [ErrorTypes.INVALID_DATA] as const

export const POST = async (
  req: HttpRequest<typeof PostInput, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  const { authProvider } = req.params

  const entityId = req.authContext.actorId

  const result = await authService.updateProvider(authProvider, { email: entityId, password: req.body.password })

  if (!result.success) {
    throw new AppError({ type: ErrorTypes.INVALID_DATA, message: result.error ?? 'Password update failed' })
  }

  return { status: 200, json: { success: true } }
}
