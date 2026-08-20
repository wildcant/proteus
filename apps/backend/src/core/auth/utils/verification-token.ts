import crypto from 'node:crypto'
import { AppError, ErrorTypes } from '../../errors/app-error.js'

export const generateVerificationToken = (): string => {
  return crypto.randomBytes(32).toString('base64url')
}

export const hashVerificationToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export const getVerificationTokenTtlMs = (ttlSeconds = 900): number => {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1) {
    throw new AppError({
      type: ErrorTypes.INVALID_ARGUMENT,
      message: 'Verification token TTL must be a positive integer',
    })
  }

  return ttlSeconds * 1000
}
