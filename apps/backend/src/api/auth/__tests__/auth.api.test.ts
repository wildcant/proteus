import type { TestApi } from '@tests/setup/create-api.js'
import { test } from '@tests/setup/test-extend.js'
import jwt from 'jsonwebtoken'
import { env } from '../../../env.js'
import authDefinitions from '../definitions.js'

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: authDefinitions })
})

test.describe('POST /auth/:actorType/:authProvider/register', () => {
  test('returns actorless JWT', async ({ expect }) => {
    const { status, body } = await api.post('/auth/user/emailpass/register', {
      email: 'reg@example.com',
      password: 'secret123',
    })

    expect(status).toBe(200)
    expect(body.token).toBeDefined()

    const decoded = jwt.verify(body.token as string, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('')
    expect(decoded.actorType).toBe('user')
    expect(decoded.authProvider).toBe('emailpass')
    expect(decoded.authIdentityId).toMatch(/^authid_/)
  })
})

test.describe('POST /auth/:actorType/:authProvider (authenticate)', () => {
  test('login without linked actor returns actorless JWT', async ({ expect }) => {
    await api.post('/auth/user/emailpass/register', {
      email: 'noactor@example.com',
      password: 'secret123',
    })

    const { status, body } = await api.post('/auth/user/emailpass', {
      email: 'noactor@example.com',
      password: 'secret123',
    })

    expect(status).toBe(200)
    const decoded = jwt.verify(body.token as string, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('')
    expect(decoded.actorType).toBe('user')
  })

  test('login with linked actor returns full JWT', async ({ expect, service }) => {
    const { body: regBody } = await api.post('/auth/user/emailpass/register', {
      email: 'linked@example.com',
      password: 'secret123',
    })

    // Simulate linking: set userId in app_metadata
    const regDecoded = jwt.verify(regBody.token as string, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = regDecoded.authIdentityId as string
    await service.update.authIdentity(api.container, authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_linked' },
    })

    const { status, body } = await api.post('/auth/user/emailpass', {
      email: 'linked@example.com',
      password: 'secret123',
    })

    expect(status).toBe(200)
    expect(body.verificationRequired).toBeUndefined()
    const decoded = jwt.verify(body.token as string, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('usr_linked')
    expect(decoded.actorType).toBe('user')
  })
})

test.describe('POST /auth/token/refresh', () => {
  test('picks up app_metadata changes on full token refresh', async ({ expect, service }) => {
    // Register
    const { body: regBody } = await api.post('/auth/user/emailpass/register', {
      email: 'refresh@example.com',
      password: 'secret123',
    })
    const regDecoded = jwt.verify(regBody.token as string, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = regDecoded.authIdentityId as string

    // Simulate linking
    await service.update.authIdentity(api.container, authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_refresh' },
    })

    // Login to get a full token (with actorId)
    const { body: loginBody } = await api.post('/auth/user/emailpass', {
      email: 'refresh@example.com',
      password: 'secret123',
    })

    // Update app_metadata again (simulate role change)
    await service.update.authIdentity(api.container, authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_refresh', role: 'admin' },
    })

    // Refresh — should pick up the new role
    const { status, body } = await api.post('/auth/token/refresh', undefined, {
      headers: { authorization: `Bearer ${loginBody.token as string}` },
    })

    expect(status).toBe(200)
    const decoded = jwt.verify(body.token as string, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('usr_refresh')
    const appMetadata = decoded.appMetadata as Record<string, unknown>
    expect(appMetadata.role).toBe('admin')
  })

  test('actorless token refresh re-runs verification checks', async ({ expect, service }) => {
    // Register (get actorless token)
    const { body: regBody } = await api.post('/auth/user/emailpass/register', {
      email: 'actorless-refresh@example.com',
      password: 'secret123',
    })
    const regDecoded = jwt.verify(regBody.token as string, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = regDecoded.authIdentityId as string

    // Simulate linking after invite accept
    await service.update.authIdentity(api.container, authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_refreshed' },
    })

    // Refresh with the actorless token — should get full token now
    const { status, body } = await api.post('/auth/token/refresh', undefined, {
      headers: { authorization: `Bearer ${regBody.token as string}` },
    })

    expect(status).toBe(200)
    const decoded = jwt.verify(body.token as string, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('usr_refreshed')
  })
})

test.describe('validateScopeProviderAssociation', () => {
  test('rejects disallowed provider for actor type', async ({ expect }) => {
    const { status, body } = await api.post('/auth/user/google/register', {
      email: 'blocked@example.com',
      password: 'secret123',
    })

    expect(status).toBe(400)
    expect(body.message).toMatch(/not allowed/)
  })
})
