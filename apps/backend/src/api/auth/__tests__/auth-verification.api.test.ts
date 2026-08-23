import type { TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import jwt from 'jsonwebtoken'
import { env } from '../../../env.js'
import authDefinitions from '../definitions.js'

type Services = Fixtures['service']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({
    definitions: authDefinitions,
    config: {
      projectConfig: {
        http: { authVerificationsPerActor: { customer: [{ entityType: 'email', authProvider: 'emailpass' }] } },
      },
    },
  })
})

/**
 * Register a customer and return the actorless JWT.
 * Customers require email verification per authVerificationsPerActor config.
 */
async function registerCustomer(email: string, password: string) {
  const { body } = await api.post('/auth/customer/emailpass/register', { email, password })
  return body.token as string
}

test.describe('POST /auth/verification/request', () => {
  test('request generates a verification record', async ({ expect }) => {
    const token = await registerCustomer('verify-request@example.com', 'secret123')

    const { status, body } = await api.post(
      '/auth/verification/request',
      { entityId: 'verify-request@example.com', entityType: 'email' },
      { headers: { authorization: `Bearer ${token}` } },
    )

    expect(status).toBe(200)
    expect(body.id).toMatch(/^authver_/)
    expect(body.entityId).toBe('verify-request@example.com')
    expect(body.entityType).toBe('email')
    expect(body.requestedAt).toBeDefined()
  })

  test('re-request rotates the code (old code stops working)', async ({ expect, service }) => {
    const token = await registerCustomer('rotate@example.com', 'secret123')

    // First request
    await api.post(
      '/auth/verification/request',
      { entityId: 'rotate@example.com', entityType: 'email' },
      { headers: { authorization: `Bearer ${token}` } },
    )

    // Get the code from the verification record's providerMetadata
    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = decoded.authIdentityId as string

    const firstVerifications = await service.read.authVerifications(api.container, { authIdentityId })
    const firstHash = (firstVerifications[0]?.providerMetadata as Record<string, unknown>)?.tokenHash

    // Second request (rotate)
    await api.post(
      '/auth/verification/request',
      { entityId: 'rotate@example.com', entityType: 'email' },
      { headers: { authorization: `Bearer ${token}` } },
    )

    const secondVerifications = await service.read.authVerifications(api.container, { authIdentityId })
    const secondHash = (secondVerifications[0]?.providerMetadata as Record<string, unknown>)?.tokenHash

    // Code was rotated: different hash, same record
    expect(secondHash).not.toBe(firstHash)
    expect(secondVerifications).toHaveLength(1)
  })
})

test.describe('POST /auth/verification/confirm', () => {
  /**
   * Helper: register customer, request verification, extract code from DB.
   */
  async function setupVerification(service: Services, email: string) {
    const token = await registerCustomer(email, 'secret123')

    // Extract plaintext code by calling requestAuthVerification directly
    // (the route doesn't return it).
    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = decoded.authIdentityId as string

    const result = await service.create.authVerification(api.container, {
      authIdentityId,
      entityId: email,
      entityType: 'email',
      codeProvider: 'token',
    })

    if (!result.code) throw new Error('Expected code from requestAuthVerification')
    return { token, code: result.code, authIdentityId }
  }

  test('confirm with correct code succeeds', async ({ expect, service }) => {
    const { token, code } = await setupVerification(service, 'confirm-ok@example.com')

    const { status, body } = await api.post(
      '/auth/verification/confirm',
      { code },
      { headers: { authorization: `Bearer ${token}` } },
    )

    expect(status).toBe(200)
    expect(body.id).toMatch(/^authver_/)
    expect(body.verifiedAt).toBeDefined()
  })

  test('confirm with wrong code fails', async ({ expect, service }) => {
    const { token } = await setupVerification(service, 'confirm-bad@example.com')

    const { status, body } = await api.post(
      '/auth/verification/confirm',
      { code: 'wrong-code-wrong-code-wrong-code-wrong-code' },
      { headers: { authorization: `Bearer ${token}` } },
    )

    expect(status).toBe(400)
    expect(body.message).toMatch(/invalid or already used/)
  })

  test('expired code is rejected', async ({ expect, service }) => {
    const token = await registerCustomer('expired@example.com', 'secret123')
    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = decoded.authIdentityId as string

    const result = await service.create.authVerification(api.container, {
      authIdentityId,
      entityId: 'expired@example.com',
      entityType: 'email',
      codeProvider: 'token',
    })

    // Backdate requestedAt to simulate expiry (> 15 minutes ago)
    const verifications = await service.read.authVerifications(api.container, { authIdentityId })
    const verification = verifications[0]
    if (verification) {
      await service.update.authVerification(api.container, verification.id, {
        requestedAt: new Date(Date.now() - 16 * 60 * 1000),
        // The generator marks a verification verified; this test needs it still pending, or the
        // route rejects it as already used and never reaches the expiry check.
        verifiedAt: null,
      })
    }

    const { status, body } = await api.post(
      '/auth/verification/confirm',
      { code: result.code },
      { headers: { authorization: `Bearer ${token}` } },
    )

    expect(status).toBe(400)
    expect(body.message).toMatch(/expired/)
  })

  test('already-verified entity cannot be re-confirmed', async ({ expect, service }) => {
    const { token, code } = await setupVerification(service, 'already-verified@example.com')

    // First confirm succeeds
    const first = await api.post(
      '/auth/verification/confirm',
      { code },
      { headers: { authorization: `Bearer ${token}` } },
    )
    expect(first.status).toBe(200)

    // Second confirm fails (already verified)
    const second = await api.post(
      '/auth/verification/confirm',
      { code },
      { headers: { authorization: `Bearer ${token}` } },
    )
    expect(second.status).toBe(400)
    expect(second.body.message).toMatch(/invalid or already used/)
  })
})

test.describe('verification gate on login', () => {
  test('customer login returns verification_required when unverified', async ({ expect }) => {
    await api.post('/auth/customer/emailpass/register', {
      email: 'gate-unverified@example.com',
      password: 'secret123',
    })

    const { status, body } = await api.post('/auth/customer/emailpass', {
      email: 'gate-unverified@example.com',
      password: 'secret123',
    })

    expect(status).toBe(200)
    expect(body.verificationRequired).toBe(true)
    const decoded = jwt.verify(body.token as string, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('')
  })

  test('customer login returns full JWT after verification', async ({ expect, service }) => {
    // Register
    const regToken = await registerCustomer('gate-verified@example.com', 'secret123')
    const decoded = jwt.verify(regToken, env.JWT_SECRET) as Record<string, unknown>
    const authIdentityId = decoded.authIdentityId as string

    // Link to a customer
    await service.update.authIdentity(api.container, authIdentityId, {
      appMetadata: { registered: true, customerId: 'cus_linked' },
    })

    // Request and confirm verification
    const verificationResult = await service.create.authVerification(api.container, {
      authIdentityId,
      entityId: 'gate-verified@example.com',
      entityType: 'email',
      codeProvider: 'token',
    })
    if (!verificationResult.code) throw new Error('Expected code from requestAuthVerification')
    await service.create.confirmedAuthVerification(api.container, { code: verificationResult.code })

    // Login should now return full JWT
    const { status, body } = await api.post('/auth/customer/emailpass', {
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
    await api.post('/auth/user/emailpass/register', {
      email: 'no-gate@example.com',
      password: 'secret123',
    })

    const { status, body } = await api.post('/auth/user/emailpass', {
      email: 'no-gate@example.com',
      password: 'secret123',
    })

    expect(status).toBe(200)
    expect(body.verificationRequired).toBeUndefined()
  })
})
