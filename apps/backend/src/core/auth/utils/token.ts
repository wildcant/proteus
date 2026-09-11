import { env } from '@env'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { AppError, ErrorTypes } from '../../errors/app-error.js'
import type { AuthTokenPayload } from '../types.js'

/**
 * The lifetime a signed token may be given, taken from jsonwebtoken's own option type.
 * Its string form (`'15m'`) is declared by `ms`, which is a transitive dependency of
 * jsonwebtoken — importing `StringValue` from there directly reached past our own manifest
 * into a package nothing in this repo declares.
 */
export type JwtExpiresIn = NonNullable<SignOptions['expiresIn']>

type JwtConfig = {
  secret: string
  expiresIn: JwtExpiresIn
  jwtOptions?: SignOptions
}

/**
 * Extract and verify a JWT from an Authorization header.
 * Returns the decoded payload or null if the header is missing/malformed.
 * Throws on invalid/expired tokens.
 */
export function extractTokenPayload(authHeader: string | undefined): AuthTokenPayload | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.slice(7)
  if (!token) {
    return null
  }

  const decoded = jwt.verify(token, env.JWT_SECRET, {
    ignoreExpiration: false,
    ignoreNotBefore: false,
  })

  if (typeof decoded !== 'object' || decoded === null) {
    return null
  }

  return Object.assign(Object.create(null), decoded) as AuthTokenPayload
}

export function generateJwtToken(payload: AuthTokenPayload, jwtConfig: JwtConfig): string {
  if (!jwtConfig.secret) {
    throw new AppError({ type: ErrorTypes.INVALID_ARGUMENT, message: 'JWT secret is required to generate a token' })
  }
  if (!jwtConfig.expiresIn) {
    throw new AppError({ type: ErrorTypes.INVALID_ARGUMENT, message: 'JWT expiresIn is required to generate a token' })
  }

  const options: SignOptions = { ...jwtConfig.jwtOptions, expiresIn: jwtConfig.expiresIn }
  return jwt.sign(payload, jwtConfig.secret, options)
}
