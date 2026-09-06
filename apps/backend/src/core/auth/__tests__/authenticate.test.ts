import { env } from '@env'
import { authenticate } from '@framework/http/middlewares/authenticate.js'
import { test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { ErrorTypes } from '../../errors/app-error.js'
import { generateJwtToken } from '../utils/token.js'

test.afterEach(() => {
  vi.useRealTimers()
})

test.describe('authenticate middleware', () => {
  test.describe('valid token', () => {
    test('populates authContext from JWT payload', async ({ makeRequest, expect }) => {
      const middleware = authenticate('user')
      const token = generateJwtToken(
        {
          actorId: 'usr_123',
          actorType: 'user',
          authIdentityId: 'authid_456',
          authProvider: 'emailpass',
          appMetadata: { registered: true },
          userMetadata: { name: 'Test' },
        },
        { secret: env.JWT_SECRET, expiresIn: '1d' },
      )

      const result = await middleware(
        makeRequest({
          headers: { authorization: `Bearer ${token}` },
        }),
      )

      expect(result.authContext).toEqual({
        actorId: 'usr_123',
        actorType: 'user',
        authIdentityId: 'authid_456',
        authProvider: 'emailpass',
        appMetadata: { registered: true },
        userMetadata: { name: 'Test' },
      })
    })
  })

  test.describe('expired token', () => {
    test('throws 401', async ({ makeRequest, expect }) => {
      vi.useFakeTimers()
      const middleware = authenticate('user')
      const token = generateJwtToken(
        {
          actorId: 'usr_123',
          actorType: 'user',
          authIdentityId: 'authid_1',
          authProvider: 'emailpass',
          appMetadata: {},
          userMetadata: {},
        },
        { secret: env.JWT_SECRET, expiresIn: '1h' },
      )

      vi.advanceTimersByTime(2 * 60 * 60 * 1000)

      await expect(middleware(makeRequest({ headers: { authorization: `Bearer ${token}` } }))).rejects.toMatchObject({
        type: ErrorTypes.UNAUTHORIZED,
      })
    })
  })

  test.describe('missing token on protected route', () => {
    test('throws 401', async ({ makeRequest, expect }) => {
      const middleware = authenticate('user')

      await expect(middleware(makeRequest())).rejects.toMatchObject({
        type: ErrorTypes.UNAUTHORIZED,
      })
    })
  })

  test.describe('wrong actor type', () => {
    test('throws 401 when token has customer type but route expects user', async ({ makeRequest, expect }) => {
      const middleware = authenticate('user')
      const token = generateJwtToken(
        {
          actorId: 'cus_123',
          actorType: 'customer',
          authIdentityId: 'authid_1',
          authProvider: 'emailpass',
          appMetadata: {},
          userMetadata: {},
        },
        { secret: env.JWT_SECRET, expiresIn: '1d' },
      )

      await expect(middleware(makeRequest({ headers: { authorization: `Bearer ${token}` } }))).rejects.toMatchObject({
        type: ErrorTypes.UNAUTHORIZED,
      })
    })
  })

  test.describe('actorless token (empty actorId)', () => {
    test('blocked on regular admin routes', async ({ makeRequest, expect }) => {
      const middleware = authenticate('user')
      const token = generateJwtToken(
        {
          actorId: '',
          actorType: 'user',
          authIdentityId: 'authid_789',
          authProvider: 'emailpass',
          appMetadata: {},
          userMetadata: {},
        },
        { secret: env.JWT_SECRET, expiresIn: '1d' },
      )

      await expect(middleware(makeRequest({ headers: { authorization: `Bearer ${token}` } }))).rejects.toMatchObject({
        type: ErrorTypes.UNAUTHORIZED,
        message: 'Unauthorized: registration required',
      })
    })

    test('allowed with allowUnregistered: true', async ({ makeRequest, expect }) => {
      const middleware = authenticate('user', { allowUnregistered: true })
      const token = generateJwtToken(
        {
          actorId: '',
          actorType: 'user',
          authIdentityId: 'authid_789',
          authProvider: 'emailpass',
          appMetadata: {},
          userMetadata: {},
        },
        { secret: env.JWT_SECRET, expiresIn: '1d' },
      )

      const result = await middleware(makeRequest({ headers: { authorization: `Bearer ${token}` } }))

      expect(result.authContext).toBeDefined()
      expect(result.authContext?.actorId).toBe('')
    })
  })

  test.describe('allowUnauthenticated', () => {
    test('missing token allowed with allowUnauthenticated: true', async ({ makeRequest, expect }) => {
      const middleware = authenticate('customer', { allowUnauthenticated: true })

      const result = await middleware(makeRequest())

      expect(result.authContext).toBeUndefined()
    })

    test('valid token still populates authContext', async ({ makeRequest, expect }) => {
      const middleware = authenticate('customer', { allowUnauthenticated: true })
      const token = generateJwtToken(
        {
          actorId: 'cus_123',
          actorType: 'customer',
          authIdentityId: 'authid_1',
          authProvider: 'emailpass',
          appMetadata: {},
          userMetadata: {},
        },
        { secret: env.JWT_SECRET, expiresIn: '1d' },
      )

      const result = await middleware(makeRequest({ headers: { authorization: `Bearer ${token}` } }))

      expect(result.authContext).toBeDefined()
      expect(result.authContext?.actorId).toBe('cus_123')
    })
  })

  test.describe('malformed tokens', () => {
    test('garbage token throws 401', async ({ makeRequest, expect }) => {
      const middleware = authenticate('user')

      await expect(
        middleware(makeRequest({ headers: { authorization: 'Bearer not-a-valid-jwt' } })),
      ).rejects.toMatchObject({ type: ErrorTypes.UNAUTHORIZED })
    })

    test('token signed with wrong secret throws 401', async ({ makeRequest, expect }) => {
      const middleware = authenticate('user')
      const token = generateJwtToken(
        {
          actorId: 'usr_1',
          actorType: 'user',
          authIdentityId: 'authid_1',
          authProvider: 'emailpass',
          appMetadata: {},
          userMetadata: {},
        },
        { secret: 'wrong-secret', expiresIn: '1d' },
      )

      await expect(middleware(makeRequest({ headers: { authorization: `Bearer ${token}` } }))).rejects.toMatchObject({
        type: ErrorTypes.UNAUTHORIZED,
      })
    })
  })
})
