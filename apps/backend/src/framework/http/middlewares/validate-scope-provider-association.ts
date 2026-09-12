import type { MiddlewareFunction } from '@framework/http/types.js'
import type { ActorType } from '@proteus/http-schemas/auth'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { ConfigModule } from '../../../core/types/config.js'
import { ContainerRegistrationKeys } from '../../../core/utils/container.js'

/**
 * Middleware that checks whether the requested auth provider is allowed
 * for the given actor type. Reads `:actor_type` and `:auth_provider`
 * from route params and validates against `authMethodsPerActor` config.
 *
 * Rejects unknown actor types and unconfigured providers.
 */
export function validateScopeProviderAssociation(): MiddlewareFunction {
  return async (req) => {
    const { actorType, authProvider } = req.params as { actorType: ActorType; authProvider: string }

    const config = req.scope.resolve<ConfigModule>(ContainerRegistrationKeys.CONFIG_MODULE)
    const allowedProviders = config.projectConfig.http.authMethodsPerActor[actorType]
    if (!allowedProviders) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Unknown actor type "${actorType}"`,
      })
    }

    if (!allowedProviders.includes(authProvider)) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Provider "${authProvider}" is not allowed for actor type "${actorType}"`,
      })
    }

    return req
  }
}
