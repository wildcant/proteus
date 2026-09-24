import type { ActorType } from '@proteus/http-schemas/auth'
import { i18n } from '@proteus/utils'
import type { AuthContext } from '../../../core/auth/types.js'
import { extractTokenPayload } from '../../../core/auth/utils/token.js'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { MiddlewareFunction } from '../types.js'

type AuthenticateOptions = {
  allowUnauthenticated?: boolean
  allowUnregistered?: boolean
}

/**
 * Extract and verify an AuthContext from a JWT bearer token.
 * Returns null if the header is missing/malformed (caller decides whether that's an error).
 */
function getAuthContextFromJwtToken(
  authHeader: string | undefined,
  actorTypes: (ActorType | '*')[],
): AuthContext | null {
  const payload = extractTokenPayload(authHeader)
  if (!payload) {
    return null
  }

  const isWildcard = actorTypes.includes('*')
  if (!payload.actorType || (!isWildcard && !actorTypes.includes(payload.actorType))) {
    throw new AppError({
      type: ErrorTypes.UNAUTHORIZED,
      message: i18n.t('Unauthorized: invalid actor type'),
    })
  }

  return {
    actorId: payload.actorId,
    actorType: payload.actorType,
    authIdentityId: payload.authIdentityId,
    authProvider: payload.authProvider,
    appMetadata: payload.appMetadata,
    userMetadata: payload.userMetadata,
  }
}

/**
 * Middleware factory that verifies JWT bearer tokens and populates `req.authContext`.
 *
 * Decision tree:
 * 1. No token -> allowUnauthenticated? proceed with no authContext : 401
 * 2. Invalid/expired token -> 401 (always)
 * 3. Valid token, empty actorId -> allowUnregistered? proceed : 401
 * 4. Valid token, has actorId -> proceed
 */
export function authenticate(actorType: ActorType | '*', options?: AuthenticateOptions): MiddlewareFunction {
  const { allowUnauthenticated = false, allowUnregistered = false } = options ?? {}

  return async (req) => {
    let authContext: AuthContext | null = null
    try {
      authContext = getAuthContextFromJwtToken(req.headers.authorization, [actorType])
    } catch (err) {
      if (AppError.isError(err)) throw err
      // jwt.verify errors (expired, malformed, etc.) -> 401
      throw new AppError({
        type: ErrorTypes.UNAUTHORIZED,
        message: i18n.t('Unauthorized: invalid token'),
      })
    }

    // No token present
    if (!authContext) {
      if (allowUnauthenticated) {
        return req
      }
      throw new AppError({
        type: ErrorTypes.UNAUTHORIZED,
        message: i18n.t('Unauthorized'),
      })
    }

    // Token valid but no actorId (unregistered session)
    if (!authContext.actorId) {
      if (!allowUnregistered) {
        throw new AppError({
          type: ErrorTypes.UNAUTHORIZED,
          message: i18n.t('Unauthorized: registration required'),
        })
      }
    }

    return { ...req, authContext }
  }
}
