import type { MiddlewareFunction } from '@framework/http/types.js'
import { AppError, ErrorTypes } from '../../errors/app-error.js'
import type { IAuthModuleService } from '../../types/index.js'
import { Modules } from '../../utils/index.js'
import type { AuthContext } from '../types.js'
import { extractTokenPayload } from './token.js'

/**
 * Middleware that validates a purpose-bound reset JWT.
 *
 * 1. Extracts JWT from Authorization header
 * 2. Verifies signature + expiry
 * 3. Guards that `purpose === "reset"` and `jti` is present
 * 4. Consumes the reset token (single-use enforcement)
 * 5. Populates `req.authContext` with fresh data from the provider identity
 */
export function validateToken(): MiddlewareFunction<{ authContext: AuthContext }> {
  return async (req) => {
    let payload: ReturnType<typeof extractTokenPayload>
    try {
      payload = extractTokenPayload(req.headers.authorization)
    } catch (err) {
      if (AppError.isError(err)) throw err
      throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Unauthorized: invalid token' })
    }

    if (!payload) {
      throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Unauthorized' })
    }

    if (payload.purpose !== 'reset' || !payload.jti) {
      throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Unauthorized: invalid token purpose' })
    }

    const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH)

    const consumed = await authService.consumePasswordResetToken({
      jti: payload.jti,
      provider: payload.authProvider,
      entityId: payload.actorId,
    })

    const [providerIdentity] = await authService.listProviderIdentities(
      { entityId: consumed.entityId, provider: payload.authProvider },
      { select: ['authIdentityId', 'entityId', 'userMetadata'] },
    )

    if (!providerIdentity) {
      throw new AppError({ type: ErrorTypes.UNAUTHORIZED, message: 'Unauthorized' })
    }

    return {
      ...req,
      authContext: {
        actorId: providerIdentity.entityId,
        actorType: payload.actorType,
        authIdentityId: providerIdentity.authIdentityId,
        authProvider: payload.authProvider,
        appMetadata: payload.appMetadata,
        userMetadata: providerIdentity.userMetadata ?? {},
      },
    }
  }
}
