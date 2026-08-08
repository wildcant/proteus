import type { DbProvider } from '@core/db/ports.js'
import type { IAuthModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { applyMiddleware } from '@framework/http/apply-middleware.js'
import { test } from '@tests/setup/test-extend.js'
import jwt from 'jsonwebtoken'
import { describe } from 'vitest'
import { bootstrapContainer } from '../../../container.js'
import { env } from '../../../env.js'
import { createApp } from '../../../server/app.js'
import type { App } from '../../../server/ports.js'
import authDefinitions from '../definitions.js'

let app: App
let authService: IAuthModuleService

test.beforeEach(async ({ getDb, logger }) => {
  const dbProvider: DbProvider = {
    getDb,
    withConnection: (fn) => fn(),
  }
  const container = await bootstrapContainer({
    logger,
    dbProvider,
    config: {
      projectConfig: {
        http: {
          authVerificationsPerActor: {
            customer: [{ entityType: 'email', authProvider: 'emailpass' }],
          },
        },
      },
    },
  })
  authService = container.resolve<IAuthModuleService>(Modules.AUTH)
  app = createApp({ container })

  const relevant = authDefinitions.filter((definition) =>
    [
      '/auth/:actorType/:authProvider/register',
      '/auth/:actorType/:authProvider',
      '/auth/token/refresh',
      '/auth/verification/request',
      '/auth/verification/confirm',
    ].includes(definition.matcher),
  )

  // Register specific routes before parametric to avoid matching issues
  const ordered = [
    ...relevant.filter((definition) => definition.matcher === '/auth/:actorType/:authProvider/register'),
    ...relevant.filter((definition) => definition.matcher === '/auth/token/refresh'),
    ...relevant.filter((definition) => definition.matcher === '/auth/verification/request'),
    ...relevant.filter((definition) => definition.matcher === '/auth/verification/confirm'),
    ...relevant.filter((definition) => definition.matcher === '/auth/:actorType/:authProvider'),
  ]

  for (const definition of ordered) {
    app.addRoute(definition.method, definition.matcher, applyMiddleware(definition))
  }
})

async function post(path: string, body?: unknown, headers?: Record<string, string>) {
  const response = await app.fetch(
    new Request(`http://test${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    }),
  )
  return { status: response.status, body: (await response.json()) as Record<string, unknown> }
}

/**
 * Register a customer and return the actorless JWT.
 * Customers require email verification per authVerificationsPerActor config.
 */
async function registerCustomer(email: string, password: string) {
  const { body } = await post('/auth/customer/emailpass/register', { email, password })
  return body.token as string
}

describe('POST /auth/verification/request', () => {
  test('request generates a verification record', async ({ expect }) => {
    const token = await registerCustomer('verify-request@example.com', 'secret123')

    const { status, body } = await post(
      '/auth/verification/request',
      { entityId: 'verify-request@example.com', entityType: 'email' },
      { authorization: `Bearer ${token}` },
    )

    expect(status).toBe(200)
    expect(body.id).toMatch(/^authver_/)
    expect(body.entityId).toBe('verify-request@example.com')
    expect(body.entityType).toBe('email')
    expect(body.requestedAt).toBeDefined()
  })

  test('re-request rotates the code (old code stops working)', async ({ expect }) => {
    const token = await registerCustomer('rotate@example.com', 'secret123')

    // First request
    await post(
      '/auth/verification/request',
      { entityId: 'rotate@example.com', entityType: 'email' },
      { authorization: `Bearer ${token}` },
    )

    // Get the code from the verification record's providerMetadata
    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = decoded.authIdentityId as string

    const firstVerifications = await authService.listAuthVerifications({ authIdentityId })
    const firstHash = (firstVerifications[0]?.providerMetadata as Record<string, unknown>)?.tokenHash

    // Second request (rotate)
    await post(
      '/auth/verification/request',
      { entityId: 'rotate@example.com', entityType: 'email' },
      { authorization: `Bearer ${token}` },
    )

    const secondVerifications = await authService.listAuthVerifications({ authIdentityId })
    const secondHash = (secondVerifications[0]?.providerMetadata as Record<string, unknown>)?.tokenHash

    // Code was rotated: different hash, same record
    expect(secondHash).not.toBe(firstHash)
    expect(secondVerifications).toHaveLength(1)
  })
})

describe('POST /auth/verification/confirm', () => {
  /**
   * Helper: register customer, request verification, extract code from DB.
   */
  async function setupVerification(email: string) {
    const token = await registerCustomer(email, 'secret123')

    // Extract plaintext code by calling requestAuthVerification directly
    // (the route doesn't return it).
    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = decoded.authIdentityId as string

    const result = await authService.requestAuthVerification({
      authIdentityId,
      entityId: email,
      entityType: 'email',
      codeProvider: 'token',
    })

    if (!result.code) throw new Error('Expected code from requestAuthVerification')
    return { token, code: result.code, authIdentityId }
  }

  test('confirm with correct code succeeds', async ({ expect }) => {
    const { token, code } = await setupVerification('confirm-ok@example.com')

    const { status, body } = await post('/auth/verification/confirm', { code }, { authorization: `Bearer ${token}` })

    expect(status).toBe(200)
    expect(body.id).toMatch(/^authver_/)
    expect(body.verifiedAt).toBeDefined()
  })

  test('confirm with wrong code fails', async ({ expect }) => {
    const { token } = await setupVerification('confirm-bad@example.com')

    const { status, body } = await post(
      '/auth/verification/confirm',
      { code: 'wrong-code-wrong-code-wrong-code-wrong-code' },
      { authorization: `Bearer ${token}` },
    )

    expect(status).toBe(400)
    expect(body.message).toMatch(/invalid or already used/)
  })

  test('expired code is rejected', async ({ expect }) => {
    const token = await registerCustomer('expired@example.com', 'secret123')
    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = decoded.authIdentityId as string

    const result = await authService.requestAuthVerification({
      authIdentityId,
      entityId: 'expired@example.com',
      entityType: 'email',
      codeProvider: 'token',
    })

    // Backdate requestedAt to simulate expiry (> 15 minutes ago)
    const verifications = await authService.listAuthVerifications({ authIdentityId })
    const verification = verifications[0]
    if (verification) {
      await authService.updateAuthVerification(verification.id, {
        requestedAt: new Date(Date.now() - 16 * 60 * 1000),
      })
    }

    const { status, body } = await post(
      '/auth/verification/confirm',
      { code: result.code },
      { authorization: `Bearer ${token}` },
    )

    expect(status).toBe(400)
    expect(body.message).toMatch(/expired/)
  })

  test('already-verified entity cannot be re-confirmed', async ({ expect }) => {
    const { token, code } = await setupVerification('already-verified@example.com')

    // First confirm succeeds
    const first = await post('/auth/verification/confirm', { code }, { authorization: `Bearer ${token}` })
    expect(first.status).toBe(200)

    // Second confirm fails (already verified)
    const second = await post('/auth/verification/confirm', { code }, { authorization: `Bearer ${token}` })
    expect(second.status).toBe(400)
    expect(second.body.message).toMatch(/invalid or already used/)
  })
})

describe('verification gate on login', () => {
  test('customer login returns verification_required when unverified', async ({ expect }) => {
    await post('/auth/customer/emailpass/register', {
      email: 'gate-unverified@example.com',
      password: 'secret123',
    })

    const { status, body } = await post('/auth/customer/emailpass', {
      email: 'gate-unverified@example.com',
      password: 'secret123',
    })

    expect(status).toBe(200)
    expect(body.verificationRequired).toBe(true)
    const decoded = jwt.verify(body.token as string, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('')
  })

  test('customer login returns full JWT after verification', async ({ expect }) => {
    // Register
    const regToken = await registerCustomer('gate-verified@example.com', 'secret123')
    const decoded = jwt.verify(regToken, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = decoded.authIdentityId as string

    // Link to a customer
    await authService.updateAuthIdentity(authIdentityId, {
      appMetadata: { registered: true, customerId: 'cus_linked' },
    })

    // Request and confirm verification
    const verificationResult = await authService.requestAuthVerification({
      authIdentityId,
      entityId: 'gate-verified@example.com',
      entityType: 'email',
      codeProvider: 'token',
    })
    if (!verificationResult.code) throw new Error('Expected code from requestAuthVerification')
    await authService.confirmAuthVerification({
      code: verificationResult.code,
      codeProvider: 'token',
    })

    // Login should now return full JWT
    const { status, body } = await post('/auth/customer/emailpass', {
      email: 'gate-verified@example.com',
      password: 'secret123',
    })

    expect(status).toBe(200)
    expect(body.verificationRequired).toBeUndefined()
    const loginDecoded = jwt.verify(body.token as string, env.JWT_SECRET) as Record<string, unknown>
    expect(loginDecoded.actorId).toBe('cus_linked')
  })

  test('user login is not gated by verification', async ({ expect }) => {
    // Register as user (users don't require verification)
    await post('/auth/user/emailpass/register', {
      email: 'no-gate@example.com',
      password: 'secret123',
    })

    const { status, body } = await post('/auth/user/emailpass', {
      email: 'no-gate@example.com',
      password: 'secret123',
    })

    expect(status).toBe(200)
    expect(body.verificationRequired).toBeUndefined()
  })
})
