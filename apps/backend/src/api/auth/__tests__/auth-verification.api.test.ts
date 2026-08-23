import type { ApiErrorBody, TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { decodeToken } from '@tests/utils/decode-token.js'
import type * as registerRoutes from '../[actorType]/[authProvider]/register/route.js'
import type * as authenticateRoutes from '../[actorType]/[authProvider]/route.js'
import authDefinitions from '../definitions.js'
import type * as confirmRoutes from '../verification/confirm/route.js'
import type * as requestRoutes from '../verification/request/route.js'

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
  const { body } = await api.post<typeof registerRoutes.PostOutput>('/auth/customer/emailpass/register', {
    email,
    password,
  })
  return body.token
}

const requestVerification = (entityId: string, token: string) =>
  api.post<typeof requestRoutes.PostOutput>(
    '/auth/verification/request',
    { entityId, entityType: 'email' },
    { headers: { authorization: `Bearer ${token}` } },
  )

const confirmVerification = <T = typeof confirmRoutes.PostOutput>(code: string, token: string) =>
  api.post<T>('/auth/verification/confirm', { code }, { headers: { authorization: `Bearer ${token}` } })

test.describe('POST /auth/verification/request', () => {
  test('request generates a verification record', async ({ expect }) => {
    const token = await registerCustomer('verify-request@example.com', 'secret123')

    const { status, body } = await requestVerification('verify-request@example.com', token)

    expect(status).toBe(200)
    expect(body.id).toMatch(/^authver_/)
    expect(body.entityId).toBe('verify-request@example.com')
    expect(body.entityType).toBe('email')
    expect(body.requestedAt).toBeDefined()
  })

  test('re-request rotates the code (old code stops working)', async ({ expect, service }) => {
    const token = await registerCustomer('rotate@example.com', 'secret123')

    // First request
    await requestVerification('rotate@example.com', token)

    // Get the code from the verification record's providerMetadata
    const { authIdentityId } = decodeToken(token)

    const firstVerifications = await service.read.authVerifications(api.container, { authIdentityId })
    const firstHash = firstVerifications[0]?.providerMetadata?.tokenHash

    // Second request (rotate)
    await requestVerification('rotate@example.com', token)

    const secondVerifications = await service.read.authVerifications(api.container, { authIdentityId })
    const secondHash = secondVerifications[0]?.providerMetadata?.tokenHash

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
    const { authIdentityId } = decodeToken(token)

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

    const { status, body } = await confirmVerification(code, token)

    expect(status).toBe(200)
    expect(body.id).toMatch(/^authver_/)
    expect(body.verifiedAt).toBeDefined()
  })

  test('confirm with wrong code fails', async ({ expect, service }) => {
    const { token } = await setupVerification(service, 'confirm-bad@example.com')

    const { status, body } = await confirmVerification<ApiErrorBody>(
      'wrong-code-wrong-code-wrong-code-wrong-code',
      token,
    )

    expect(status).toBe(400)
    expect(body.message).toMatch(/invalid or already used/)
  })

  test('expired code is rejected', async ({ expect, service }) => {
    const token = await registerCustomer('expired@example.com', 'secret123')
    const { authIdentityId } = decodeToken(token)

    const result = await service.create.authVerification(api.container, {
      authIdentityId,
      entityId: 'expired@example.com',
      entityType: 'email',
      codeProvider: 'token',
    })
    if (!result.code) throw new Error('Expected code from requestAuthVerification')

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

    const { status, body } = await confirmVerification<ApiErrorBody>(result.code, token)

    expect(status).toBe(400)
    expect(body.message).toMatch(/expired/)
  })

  test('already-verified entity cannot be re-confirmed', async ({ expect, service }) => {
    const { token, code } = await setupVerification(service, 'already-verified@example.com')

    // First confirm succeeds
    const first = await confirmVerification(code, token)
    expect(first.status).toBe(200)

    // Second confirm fails (already verified)
    const second = await confirmVerification<ApiErrorBody>(code, token)
    expect(second.status).toBe(400)
    expect(second.body.message).toMatch(/invalid or already used/)
  })
})

test.describe('verification gate on login', () => {
  const login = (email: string, actorType: 'customer' | 'user' = 'customer') =>
    api.post<typeof authenticateRoutes.PostOutput>(`/auth/${actorType}/emailpass`, {
      email,
      password: 'secret123',
    })

  test('customer login returns verification_required when unverified', async ({ expect }) => {
    await registerCustomer('gate-unverified@example.com', 'secret123')

    const { status, body } = await login('gate-unverified@example.com')

    expect(status).toBe(200)
    expect(body.verificationRequired).toBe(true)
    expect(decodeToken(body.token).actorId).toBe('')
  })

  test('customer login returns full JWT after verification', async ({ expect, service }) => {
    // Register
    const registrationToken = await registerCustomer('gate-verified@example.com', 'secret123')
    const { authIdentityId } = decodeToken(registrationToken)

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
    const { status, body } = await login('gate-verified@example.com')

    expect(status).toBe(200)
    expect(body.verificationRequired).toBeUndefined()
    expect(decodeToken(body.token).actorId).toBe('cus_linked')
  })

  test('user login is not gated by verification', async ({ expect }) => {
    // Register as user (users don't require verification)
    await api.post<typeof registerRoutes.PostOutput>('/auth/user/emailpass/register', {
      email: 'no-gate@example.com',
      password: 'secret123',
    })

    const { status, body } = await login('no-gate@example.com', 'user')

    expect(status).toBe(200)
    expect(body.verificationRequired).toBeUndefined()
  })
})
