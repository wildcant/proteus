import {
  generateJwtTokenForAuthIdentity,
  generateJwtTokenWithChecks,
  getAuthJwtConfig,
} from '@core/auth/utils/generate-jwt-token.js'
import type { ConfigModule } from '@core/config/types.js'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { IAuthModuleService } from '@core/types/index.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { authenticate } from '@framework/http/middlewares/authenticate.js'
import { AuthenticateResponse } from '@proteus/http-schemas/auth'
import type { HttpRequest, HttpResult } from '../../../../server/ports.js'

export const PostMiddlewares = [authenticate('*', { allowUnregistered: true })] as const
export const PostOutput = AuthenticateResponse

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
