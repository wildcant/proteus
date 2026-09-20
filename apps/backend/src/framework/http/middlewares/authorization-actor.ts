import type { AuthorizationActor } from '../../../core/auth/types.js'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import { Modules } from '../../../core/utils/modules-definition.js'
import type { MiddlewareFunction } from '../types.js'

export function resolveAuthorizationActor(): MiddlewareFunction {
  return async (req) => {
    if (!req.authContext) {
      throw new AppError({
        type: ErrorTypes.UNAUTHORIZED,
        message: 'Unauthorized',
      })
    }

    const { actorId, actorType } = req.authContext

    const accessControlService = req.scope.resolve(Modules.ACCESS_CONTROL)

    const permissionKeys = await accessControlService.resolveEffectiveFeatures(actorType, actorId)

    const authorizationActor: AuthorizationActor = {
      id: actorId,
      type: actorType,
      grantedFeatures: new Set(permissionKeys),
      unrestricted: false,
    }

    return { ...req, authorizationActor }
  }
}
