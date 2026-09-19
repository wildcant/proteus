import type { AuthorizationActor } from '../../../core/auth/types.js'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { MiddlewareFunction } from '../types.js'

type PermissionResolver = {
  listGrantedPermissionKeys(actorType: string, actorId: string): Promise<string[]>
}

const ACCESS_CONTROL_MODULE_KEY = 'access-control'

export function resolveAuthorizationActor(): MiddlewareFunction {
  return async (req) => {
    if (!req.authContext) {
      throw new AppError({
        type: ErrorTypes.UNAUTHORIZED,
        message: 'Unauthorized',
      })
    }

    const { actorId, actorType } = req.authContext

    const resolver = req.scope.resolve<PermissionResolver>(ACCESS_CONTROL_MODULE_KEY)

    const permissionKeys = await resolver.listGrantedPermissionKeys(actorType, actorId)

    const authorizationActor: AuthorizationActor = {
      id: actorId,
      type: actorType,
      grantedFeatures: new Set(permissionKeys),
      unrestricted: false,
    }

    return { ...req, authorizationActor }
  }
}
