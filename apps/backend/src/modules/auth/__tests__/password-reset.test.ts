import crypto from 'node:crypto'
import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { asValue, createContainer } from 'awilix'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import { EmailpassProvider } from '../../../providers/auth-emailpass/emailpass.js'
import { AuthIdentityRepository } from '../repositories/auth-identity.js'
import { AuthPasswordResetTokenRepository } from '../repositories/auth-password-reset-token.js'
import { AuthVerificationRepository } from '../repositories/auth-verification.js'
import { ProviderIdentityRepository } from '../repositories/provider-identity.js'
import { AuthModuleService } from '../services/auth-module-service.js'
import { AuthProviderService } from '../services/auth-provider-service.js'
import { VerificationProviderService } from '../services/verification-provider-service.js'

let service: AuthModuleService

const EMAIL_PASS_KEY = 'au_emailpass'
const TEST_SCRYPT_OPTIONS = { logN: 1, r: 1, p: 1 }

test.beforeEach(({ getDb, logger }) => {
  const authIdentityRepository = new AuthIdentityRepository({ getDb })
  const providerIdentityRepository = new ProviderIdentityRepository({ getDb })
  const authVerificationRepository = new AuthVerificationRepository({ getDb })
  const authPasswordResetTokenRepository = new AuthPasswordResetTokenRepository({ getDb })
  const withTransaction = createWithTransaction(getDb)

  const container = createContainer()
  const emailpass = new EmailpassProvider({}, TEST_SCRYPT_OPTIONS)
  container.register({ [EMAIL_PASS_KEY]: asValue(emailpass) })
  const authProviderService = new AuthProviderService({ container })
  const verificationProviderService = new VerificationProviderService({ container })

  service = new AuthModuleService({
    authIdentityRepository,
    providerIdentityRepository,
    authVerificationRepository,
    authPasswordResetTokenRepository,
    authProviderService,
    verificationProviderService,
    withTransaction,
    logger,
  })
})

async function registerUser(email: string, password: string) {
  const result = await service.register('emailpass', { body: { email, password } })
  assertDefined(result.authIdentity)
  return result.authIdentity
}

test.describe('createPasswordResetToken', () => {
  test('creates a reset token and returns jti + providerIdentity + expiresAt', async ({ expect }) => {
    await registerUser('reset@example.com', 'password123')

    const result = await service.createPasswordResetToken({
      provider: 'emailpass',
      entityId: 'reset@example.com',
    })

    assertDefined(result)
    expect(result.jti).toBeTruthy()
    expect(result.expiresAt).toBeInstanceOf(Date)
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now())
    expect(result.providerIdentity.entityId).toBe('reset@example.com')
    expect(result.providerIdentity.provider).toBe('emailpass')
  })

  test('throws NOT_FOUND for nonexistent email', async ({ expect }) => {
    const error = await service
      .createPasswordResetToken({
        provider: 'emailpass',
        entityId: 'ghost@example.com',
      })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_FOUND)
    expect(error.message).toContain('ghost@example.com')
    expect(error.message).toContain('emailpass')
  })

  test('invalidates prior tokens on new request', async ({ expect }) => {
    await registerUser('invalidate@example.com', 'password123')

    const first = await service.createPasswordResetToken({
      provider: 'emailpass',
      entityId: 'invalidate@example.com',
    })
    assertDefined(first)

    // Request a new token — prior one should be invalidated
    const second = await service.createPasswordResetToken({
      provider: 'emailpass',
      entityId: 'invalidate@example.com',
    })
    assertDefined(second)

    // First token's jti should no longer be consumable
    const firstHash = crypto.createHash('sha256').update(first.jti).digest('hex')
    const record = await service.findAuthPasswordResetTokenByHash(firstHash)
    expect(record).toBeNull()
  })
})

test.describe('consumePasswordResetToken', () => {
  test('succeeds on first use', async ({ expect }) => {
    await registerUser('consume@example.com', 'password123')

    const created = await service.createPasswordResetToken({
      provider: 'emailpass',
      entityId: 'consume@example.com',
    })
    assertDefined(created)

    const result = await service.consumePasswordResetToken({
      jti: created.jti,
      provider: 'emailpass',
      entityId: 'consume@example.com',
    })

    expect(result.entityId).toBe('consume@example.com')
    expect(result.authIdentityId).toBeTruthy()
    expect(result.providerIdentityId).toBeTruthy()
  })

  test('fails on second use (single-use)', async ({ expect }) => {
    await registerUser('single-use@example.com', 'password123')

    const created = await service.createPasswordResetToken({
      provider: 'emailpass',
      entityId: 'single-use@example.com',
    })
    assertDefined(created)

    // First consumption succeeds
    await service.consumePasswordResetToken({
      jti: created.jti,
      provider: 'emailpass',
      entityId: 'single-use@example.com',
    })

    // Second consumption fails
    const error = await service
      .consumePasswordResetToken({
        jti: created.jti,
        provider: 'emailpass',
        entityId: 'single-use@example.com',
      })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.UNAUTHORIZED)
  })

  test('rejects expired token', async ({ expect }) => {
    await registerUser('expired@example.com', 'password123')

    const created = await service.createPasswordResetToken({
      provider: 'emailpass',
      entityId: 'expired@example.com',
      ttlSeconds: 0,
    })
    assertDefined(created)

    // Wait a tick so the token is expired
    await new Promise((resolve) => setTimeout(resolve, 10))

    const error = await service
      .consumePasswordResetToken({
        jti: created.jti,
        provider: 'emailpass',
        entityId: 'expired@example.com',
      })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.UNAUTHORIZED)
  })

  test('rejects invalid jti', async ({ expect }) => {
    const error = await service
      .consumePasswordResetToken({
        jti: 'nonexistent-jti',
        provider: 'emailpass',
        entityId: 'anyone@example.com',
      })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.UNAUTHORIZED)
  })

  test('rejects mismatched provider', async ({ expect }) => {
    await registerUser('mismatch@example.com', 'password123')

    const created = await service.createPasswordResetToken({
      provider: 'emailpass',
      entityId: 'mismatch@example.com',
    })
    assertDefined(created)

    const error = await service
      .consumePasswordResetToken({
        jti: created.jti,
        provider: 'wrong-provider',
        entityId: 'mismatch@example.com',
      })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.UNAUTHORIZED)
  })

  test('rejects mismatched entityId', async ({ expect }) => {
    await registerUser('correct@example.com', 'password123')

    const created = await service.createPasswordResetToken({
      provider: 'emailpass',
      entityId: 'correct@example.com',
    })
    assertDefined(created)

    const error = await service
      .consumePasswordResetToken({
        jti: created.jti,
        provider: 'emailpass',
        entityId: 'wrong@example.com',
      })
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.UNAUTHORIZED)
  })
})

test.describe('password reset end-to-end', () => {
  test('password updated successfully + login with new password succeeds', async ({ expect }) => {
    await registerUser('e2e@example.com', 'old-password')

    // Create reset token
    const resetResult = await service.createPasswordResetToken({
      provider: 'emailpass',
      entityId: 'e2e@example.com',
    })
    assertDefined(resetResult)

    // Consume the token (as validateToken middleware would do)
    await service.consumePasswordResetToken({
      jti: resetResult.jti,
      provider: 'emailpass',
      entityId: 'e2e@example.com',
    })

    // Update the password (as the update route handler would do)
    const updateResult = await service.updateProvider('emailpass', {
      email: 'e2e@example.com',
      password: 'new-password',
    })
    expect(updateResult.success).toBe(true)

    // Old password should no longer work
    const oldAuth = await service.authenticate('emailpass', {
      body: { email: 'e2e@example.com', password: 'old-password' },
    })
    expect(oldAuth.success).toBe(false)

    // New password should work
    const newAuth = await service.authenticate('emailpass', {
      body: { email: 'e2e@example.com', password: 'new-password' },
    })
    expect(newAuth.success).toBe(true)
  })
})
