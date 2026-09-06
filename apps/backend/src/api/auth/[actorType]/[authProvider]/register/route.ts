import { generateJwtTokenForAuthIdentity, getAuthJwtConfig } from '@core/auth/utils/generate-jwt-token.js'
import { validateScopeProviderAssociation } from '@core/auth/utils/validate-scope-provider-association.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { AuthBody, AuthParams, AuthTokenResponse } from '@proteus/http-schemas/auth'
import type { HttpRequest, HttpResult } from '@server/ports.js'

export const PostInput = { body: AuthBody, params: AuthParams }
export const PostMiddlewares = [validateScopeProviderAssociation()] as const
export const PostOutput = AuthTokenResponse

export const POST = async (
  req: HttpRequest<typeof PostInput, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  const { actorType, authProvider } = req.params

  const result = await authService.register(authProvider, { body: req.body })
  if (!result.success || !result.authIdentity) {
    throw new AppError({ type: ErrorTypes.INVALID_DATA, message: result.error ?? 'Registration failed' })
  }

  const token = generateJwtTokenForAuthIdentity(
    { authIdentity: result.authIdentity, actorType, authProvider },
    getAuthJwtConfig(),
    { actorless: true },
  )

  return { status: 200, json: { token } }
}
