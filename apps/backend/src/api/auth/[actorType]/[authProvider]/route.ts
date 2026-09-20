import { generateJwtTokenWithChecks, getAuthJwtConfig } from '@core/auth/utils/generate-jwt-token.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/auth/service.js'
import type { ConfigModule } from '@core/types/config.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { validateScopeProviderAssociation } from '@framework/http/middlewares/validate-scope-provider-association.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AuthBody, AuthenticateResponse, AuthParams } from '@proteus/http-schemas/auth'

export const PostInput = { body: AuthBody, params: AuthParams }
export const PostMiddlewares = [validateScopeProviderAssociation()] as const
export const PostOutput = AuthenticateResponse
export const PostThrows = [ErrorTypes.UNAUTHORIZED] as const

export const POST = async (
  req: HttpRequest<typeof PostInput, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  const config = req.scope.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE)

  const { actorType, authProvider } = req.params

  const result = await authService.authenticate(authProvider, { body: req.body })
  if (!result.success || !result.authIdentity) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: result.error ?? 'Authentication failed' })
  }

  const tokenResult = await generateJwtTokenWithChecks(
    authService,
    {
      authIdentity: result.authIdentity,
      actorType,
      authProvider,
    },
    getAuthJwtConfig(),
    config.projectConfig.http.authVerificationsPerActor,
  )

  return { status: 200, json: tokenResult }
}
