import { test } from '@tests/setup/test-extend.js'
import jwt from 'jsonwebtoken'
import { vi } from 'vitest'
import { AppError } from '../../errors/app-error.js'
import type { AuthTokenPayload } from '../types.js'
import { generateJwtToken } from '../utils/token.js'

const SECRET = 'test-secret'

const validPayload: AuthTokenPayload = {
  actorId: 'usr_123',
  actorType: 'user',
  authIdentityId: 'authid_456',
  authProvider: 'emailpass',
  appMetadata: {},
  userMetadata: {},
}

test.afterEach(() => {
  vi.useRealTimers()
})

test.describe('generateJwtToken', () => {
  test('produces a valid JWT that can be verified', ({ expect }) => {
    const token = generateJwtToken(validPayload, { secret: SECRET, expiresIn: '1d' })

    const decoded = jwt.verify(token, SECRET)
    expect(typeof decoded).toBe('object')
    expect((decoded as Record<string, unknown>).actorId).toBe('usr_123')
    expect((decoded as Record<string, unknown>).actorType).toBe('user')
  })

  test('throws AppError when secret is empty', ({ expect }) => {
    expect(() => generateJwtToken(validPayload, { secret: '', expiresIn: '1d' })).toThrow(AppError)
  })

  test('throws AppError when expiresIn is empty', ({ expect }) => {
    expect(() => generateJwtToken(validPayload, { secret: SECRET, expiresIn: '' as '1d' })).toThrow(AppError)
  })

  test('token verifies before expiry and rejects after', ({ expect }) => {
    vi.useFakeTimers()

    const token = generateJwtToken(validPayload, { secret: SECRET, expiresIn: '2h' })

    // Still valid just before expiry
    vi.advanceTimersByTime(2 * 60 * 60 * 1000 - 1000)
    expect(() => jwt.verify(token, SECRET)).not.toThrow()

    // Expired after 2 hours
    vi.advanceTimersByTime(2000)
    expect(() => jwt.verify(token, SECRET)).toThrow('jwt expired')
  })
})
