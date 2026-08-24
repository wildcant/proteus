import type { AuthTokenPayload } from '../../src/core/auth/types.js'
import { extractTokenPayload } from '../../src/core/auth/utils/token.js'

/**
 * Verifies and decodes an auth token with the same function the routes use, so a test reads
 * exactly what a request would carry — and reads it typed, rather than casting `jwt.verify`'s
 * `string | JwtPayload` at every call site.
 */
export function decodeToken(token: string): AuthTokenPayload {
  const payload = extractTokenPayload(`Bearer ${token}`)
  if (!payload) throw new Error('Expected a verifiable JWT')

  return payload
}
