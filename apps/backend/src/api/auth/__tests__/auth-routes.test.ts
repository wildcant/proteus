import type { DbProvider } from '@core/db/ports.js'
import type { IAuthModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { applyMiddleware } from '@framework/http/apply-middleware.js'
import { test } from '@tests/setup/test-extend.js'
import type { Express } from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { describe } from 'vitest'
import { bootstrapContainer } from '../../../container.js'
import { env } from '../../../env.js'
import { createExpressApp } from '../../../framework/runtime/express/app.js'
import authDefinitions from '../definitions.js'

let expressApp: Express
let authService: IAuthModuleService

test.beforeEach(async ({ getDb, logger }) => {
  const dbProvider: DbProvider = {
    getDb,
    withConnection: (fn) => fn(),
    shutdown: async () => {
      // noop
    },
  }
  const container = await bootstrapContainer({ logger, dbProvider })
  authService = container.resolve<IAuthModuleService>(Modules.AUTH)

  const relevant = authDefinitions.filter((definition) =>
    ['/auth/:actorType/:authProvider/register', '/auth/:actorType/:authProvider', '/auth/token/refresh'].includes(
      definition.matcher,
    ),
  )

  const ordered = [
    ...relevant.filter((definition) => definition.matcher === '/auth/:actorType/:authProvider/register'),
    ...relevant.filter((definition) => definition.matcher === '/auth/token/refresh'),
    ...relevant.filter((definition) => definition.matcher === '/auth/:actorType/:authProvider'),
  ]

  const routes = ordered.map((definition) => ({
    method: definition.method,
    matcher: definition.matcher,
    handler: applyMiddleware(definition),
  }))

  expressApp = createExpressApp({ routes, container, logger, corsOrigins: [] })
})

async function post(path: string, body?: object, headers?: Record<string, string>) {
  const response = await request(expressApp)
    .post(path)
    .set('Content-Type', 'application/json')
    .set(headers ?? {})
    .send(body)
  return { status: response.status, body: response.body as Record<string, unknown> }
}

describe('POST /auth/:actorType/:authProvider/register', () => {
  test('returns actorless JWT', async ({ expect }) => {
    const { status, body } = await post('/auth/user/emailpass/register', {
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

describe('POST /auth/:actorType/:authProvider (authenticate)', () => {
  test('login without linked actor returns actorless JWT', async ({ expect }) => {
    await post('/auth/user/emailpass/register', {
      email: 'noactor@example.com',
      password: 'secret123',
    })

    const { status, body } = await post('/auth/user/emailpass', {
      email: 'noactor@example.com',
      password: 'secret123',
    })

    expect(status).toBe(200)
    const decoded = jwt.verify(body.token as string, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('')
    expect(decoded.actorType).toBe('user')
  })

  test('login with linked actor returns full JWT', async ({ expect }) => {
    const { body: regBody } = await post('/auth/user/emailpass/register', {
      email: 'linked@example.com',
      password: 'secret123',
    })

    // Simulate linking: set userId in app_metadata
    const regDecoded = jwt.verify(regBody.token as string, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = regDecoded.authIdentityId as string
    await authService.updateAuthIdentity(authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_linked' },
    })

    const { status, body } = await post('/auth/user/emailpass', {
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

describe('POST /auth/token/refresh', () => {
  test('picks up app_metadata changes on full token refresh', async ({ expect }) => {
    // Register
    const { body: regBody } = await post('/auth/user/emailpass/register', {
      email: 'refresh@example.com',
      password: 'secret123',
    })
    const regDecoded = jwt.verify(regBody.token as string, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = regDecoded.authIdentityId as string

    // Simulate linking
    await authService.updateAuthIdentity(authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_refresh' },
    })

    // Login to get a full token (with actorId)
    const { body: loginBody } = await post('/auth/user/emailpass', {
      email: 'refresh@example.com',
      password: 'secret123',
    })

    // Update app_metadata again (simulate role change)
    await authService.updateAuthIdentity(authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_refresh', role: 'admin' },
    })

    // Refresh — should pick up the new role
    const { status, body } = await post('/auth/token/refresh', undefined, {
      authorization: `Bearer ${loginBody.token as string}`,
    })

    expect(status).toBe(200)
    const decoded = jwt.verify(body.token as string, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('usr_refresh')
    const appMetadata = decoded.appMetadata as Record<string, unknown>
    expect(appMetadata.role).toBe('admin')
  })

  test('actorless token refresh re-runs verification checks', async ({ expect }) => {
    // Register (get actorless token)
    const { body: regBody } = await post('/auth/user/emailpass/register', {
      email: 'actorless-refresh@example.com',
      password: 'secret123',
    })
    const regDecoded = jwt.verify(regBody.token as string, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = regDecoded.authIdentityId as string

    // Simulate linking after invite accept
    await authService.updateAuthIdentity(authIdentityId, {
      appMetadata: { registered: true, userId: 'usr_refreshed' },
    })

    // Refresh with the actorless token — should get full token now
    const { status, body } = await post('/auth/token/refresh', undefined, {
      authorization: `Bearer ${regBody.token as string}`,
    })

    expect(status).toBe(200)
    const decoded = jwt.verify(body.token as string, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('usr_refreshed')
  })
})

describe('validateScopeProviderAssociation', () => {
  test('rejects disallowed provider for actor type', async ({ expect }) => {
    const { status, body } = await post('/auth/user/google/register', {
      email: 'blocked@example.com',
      password: 'secret123',
    })

    expect(status).toBe(400)
    expect(body.message).toMatch(/not allowed/)
  })
})
