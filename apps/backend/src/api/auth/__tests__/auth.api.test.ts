import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import { decodeToken } from '@tests/utils/decode-token.js'
import type * as registerRoutes from '../[actorType]/[authProvider]/register/route.js'
import type * as authenticateRoutes from '../[actorType]/[authProvider]/route.js'
import authDefinitions from '../definitions.js'
import type * as refreshRoutes from '../token/refresh/route.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: authDefinitions })
})

const register = (email: string) =>
  api.post<typeof registerRoutes.PostOutput>('/auth/user/emailpass/register', { email, password: 'secret123' })

const login = (email: string) =>
  api.post<typeof authenticateRoutes.PostOutput>('/auth/user/emailpass', { email, password: 'secret123' })

test.describe('POST /auth/:actorType/:authProvider/register', () => {
  test('returns actorless JWT', async ({ expect }) => {
    const { status, body } = await register('reg@example.com')

    expect(status).toBe(200)
    expect(body.token).toBeDefined()

    const decoded = decodeToken(body.token)
    expect(decoded.actorId).toBe('')
    expect(decoded.actorType).toBe('user')
    expect(decoded.authProvider).toBe('emailpass')
    expect(decoded.authIdentityId).toMatch(/^authid_/)
  })
})

test.describe('POST /auth/:actorType/:authProvider (authenticate)', () => {
  test('login without linked actor returns actorless JWT', async ({ expect }) => {
    await register('noactor@example.com')

    const { status, body } = await login('noactor@example.com')

    expect(status).toBe(200)
    const decoded = decodeToken(body.token)
    expect(decoded.actorId).toBe('')
    expect(decoded.actorType).toBe('user')
  })

  test('login with linked actor returns full JWT', async ({ expect, service }) => {
    const { body: registered } = await register('linked@example.com')

    // Simulate linking: set userId in app_metadata
    await service.update.authIdentity(api.container, decodeToken(registered.token).authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_linked' },
    })

    const { status, body } = await login('linked@example.com')

    expect(status).toBe(200)
    expect(body.verificationRequired).toBeUndefined()
    const decoded = decodeToken(body.token)
    expect(decoded.actorId).toBe('usr_linked')
    expect(decoded.actorType).toBe('user')
  })
})

test.describe('POST /auth/token/refresh', () => {
  const refresh = (token: string) =>
    api.post<typeof refreshRoutes.PostOutput>('/auth/token/refresh', undefined, {
      headers: { authorization: `Bearer ${token}` },
    })

  test('picks up app_metadata changes on full token refresh', async ({ expect, service }) => {
    const { body: registered } = await register('refresh@example.com')
    const authIdentityId = decodeToken(registered.token).authIdentityId

    // Simulate linking
    await service.update.authIdentity(api.container, authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_refresh' },
    })

    // Login to get a full token (with actorId)
    const { body: loggedIn } = await login('refresh@example.com')

    // Update app_metadata again (simulate role change)
    await service.update.authIdentity(api.container, authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_refresh', role: 'admin' },
    })

    // Refresh — should pick up the new role
    const { status, body } = await refresh(loggedIn.token)

    expect(status).toBe(200)
    const decoded = decodeToken(body.token)
    expect(decoded.actorId).toBe('usr_refresh')
    expect(decoded.appMetadata.role).toBe('admin')
  })

  test('actorless token refresh re-runs verification checks', async ({ expect, service }) => {
    // Register (get actorless token)
    const { body: registered } = await register('actorless-refresh@example.com')

    // Simulate linking after invite accept
    await service.update.authIdentity(api.container, decodeToken(registered.token).authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_refreshed' },
    })

    // Refresh with the actorless token — should get full token now
    const { status, body } = await refresh(registered.token)

    expect(status).toBe(200)
    expect(decodeToken(body.token).actorId).toBe('usr_refreshed')
  })
})

test.describe('validateScopeProviderAssociation', () => {
  test('rejects disallowed provider for actor type', async ({ expect }) => {
    const { status, body } = await api.post<ApiErrorBody>('/auth/user/google/register', {
      email: 'blocked@example.com',
      password: 'secret123',
    })

    expect(status).toBe(400)
    expect(body.message).toMatch(/not allowed/)
  })
})
