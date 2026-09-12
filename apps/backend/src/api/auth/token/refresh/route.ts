import {
  generateJwtTokenForAuthIdentity,
  generateJwtTokenWithChecks,
  getAuthJwtConfig,
} from '@core/auth/utils/generate-jwt-token.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/auth/service.js'
import type { ConfigModule } from '@core/types/config.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { authenticate } from '@framework/http/middlewares/authenticate.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AuthenticateResponse } from '@proteus/http-schemas/auth'

export const PostMiddlewares = [authenticate('*', { allowUnregistered: true })] as const
export const PostOutput = AuthenticateResponse
export const PostThrows = [ErrorTypes.UNAUTHORIZED] as const

export const POST = async (
  req: HttpRequest<object, typeof PostMiddlewares>,
): Promise<HttpResult<typeof PostOutput>> => {
  const authContext = req.authContext
  if (!authContext) {
    throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Unauthorized' })
  }

  const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)
  const jwtConfig = getAuthJwtConfig()

  if (authContext.actorId) {
    // Branch 1: Full token — re-sign with fresh app_metadata
    const authIdentity = await authService.retrieveAuthIdentity(authContext.authIdentityId)
    const providerIdentities = await authService.listProviderIdentities({
      authIdentityId: authIdentity.id,
    })

    const token = generateJwtTokenForAuthIdentity(
      {
        authIdentity: { ...authIdentity, providerIdentities },
        actorType: authContext.actorType,
        authProvider: authContext.authProvider,
      },
      jwtConfig,
    )

    return { status: 200, json: { token } }
  }

  // Branch 2: Actorless token — re-validate and run verification checks
  const config = req.scope.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE)
  const { authIdentity } = await authService.validateAuthIdentity(authContext.authIdentityId, authContext.authProvider)

  const tokenResult = await generateJwtTokenWithChecks(
    authService,
    {
      authIdentity,
      actorType: authContext.actorType,
      authProvider: authContext.authProvider,
    },
    jwtConfig,
    config.projectConfig.http.authVerificationsPerActor,
  )

  return { status: 200, json: tokenResult }
}
