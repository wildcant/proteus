import type { ActorType } from '@proteus/http-schemas/auth'
import { generateJwtToken } from '../../src/core/auth/utils/token.js'
import { env } from '../../src/env.js'

/**
 * An `authorization` header for an actor, signed with the same secret the routes verify against,
 * so the request travels the real `authenticate` middleware rather than a stubbed context.
 *
 * Minting the token directly keeps a test about one namespace from having to mount `/auth` and
 * register its way to a session first. Only `actorId` and `actorType` decide what a store route
 * lets through, so the rest is filled in to make a well-formed payload and nothing more.
 */
export function authHeader(actorType: ActorType, actorId: string): Record<string, string> {
  const token = generateJwtToken(
    {
      actorId,
      actorType,
      authIdentityId: `authid_${actorId}`,
      authProvider: 'emailpass',
      appMetadata: {},
      userMetadata: {},
    },
    { secret: env.JWT_SECRET, expiresIn: '1h' },
  )

  return { authorization: `Bearer ${token}` }
}
