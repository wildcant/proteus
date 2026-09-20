import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import { ContainerRegistrationKeys } from '../../../core/utils/container.js'
import type { MiddlewareFunction, PermissionKey } from '../types.js'

function isSelfReadBypass(matcher: string, method: string): boolean {
  return method === 'GET' && matcher === '/admin/users/me'
}

function coversAllFeatures(granted: ReadonlySet<string>, required: PermissionKey[]): boolean {
  return required.every((key) => granted.has(key))
}

export function authorize(permissions: PermissionKey[], matcher: string, method: string): MiddlewareFunction {
  const selfReadBypass = isSelfReadBypass(matcher, method)

  return async (req) => {
    if (selfReadBypass) {
      return req
    }

    const actor = req.authorizationActor
    if (!actor) {
      throw new AppError({
        type: ErrorTypes.FORBIDDEN,
        message: 'Insufficient permissions',
      })
    }

    if (!coversAllFeatures(actor.grantedFeatures, permissions)) {
      const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
      logger.warn(`Authorization denied: actor ${actor.id} missing permissions for ${method} ${matcher}`)

      throw new AppError({
        type: ErrorTypes.FORBIDDEN,
        message: 'Insufficient permissions',
      })
    }

    return req
  }
}
