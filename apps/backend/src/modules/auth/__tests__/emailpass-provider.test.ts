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

// Use fast scrypt params for tests
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

test.describe('Emailpass provider — register', () => {
  test('creates auth_identity + provider_identity', async ({ expect }) => {
    const result = await service.register('emailpass', {
      body: { email: 'new@example.com', password: 'secret123' },
    })

    expect(result.success).toBe(true)
    assertDefined(result.authIdentity)
    expect(result.authIdentity.id).toMatch(/^authid_/)
    assertDefined(result.authIdentity.providerIdentities)
    expect(result.authIdentity.providerIdentities).toHaveLength(1)
    expect(result.authIdentity.providerIdentities[0]?.entityId).toBe('new@example.com')
    expect(result.authIdentity.providerIdentities[0]?.provider).toBe('emailpass')
  })

  test('password hash is never in returned data', async ({ expect }) => {
    const result = await service.register('emailpass', {
      body: { email: 'hash-check@example.com', password: 'secret123' },
    })

    expect(result.success).toBe(true)
    assertDefined(result.authIdentity)
    assertDefined(result.authIdentity.providerIdentities)
    expect(result.authIdentity.providerIdentities[0]?.providerMetadata?.password).toBeUndefined()
  })

  test('rejects duplicate email', async ({ expect }) => {
    await service.register('emailpass', {
      body: { email: 'dup@example.com', password: 'first' },
    })

    const result = await service.register('emailpass', {
      body: { email: 'dup@example.com', password: 'second' },
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('already exists')
  })

  test('requires email and password', async ({ expect }) => {
    const noEmail = await service.register('emailpass', { body: { password: 'x' } })
    expect(noEmail.success).toBe(false)

    const noPassword = await service.register('emailpass', { body: { email: 'x@x.com' } })
    expect(noPassword.success).toBe(false)
  })

  test('claimable identity claimed with new password', async ({ expect, getDb }) => {
    const authIdentityRepo = new AuthIdentityRepository({ getDb })
    const providerIdentityRepo = new ProviderIdentityRepository({ getDb })

    const identities = await authIdentityRepo.createMany([{ appMetadata: null }])
    const authIdentity = identities[0]
    assertDefined(authIdentity)

    await providerIdentityRepo.createMany([
      {
        authIdentityId: authIdentity.id,
        entityId: 'claimable@example.com',
        provider: 'emailpass',
        providerMetadata: null,
      },
    ])

    const result = await service.register('emailpass', {
      body: { email: 'claimable@example.com', password: 'claimed-password' },
    })

    expect(result.success).toBe(true)
    assertDefined(result.authIdentity)
    expect(result.authIdentity.id).toBe(authIdentity.id)
    expect(result.authIdentity.appMetadata).toEqual({ claimed: true })
    assertDefined(result.authIdentity.providerIdentities)
    expect(result.authIdentity.providerIdentities[0]?.providerMetadata?.password).toBeUndefined()
  })
})

test.describe('Emailpass provider — authenticate', () => {
  test('succeeds with correct password', async ({ expect }) => {
    await service.register('emailpass', {
      body: { email: 'auth@example.com', password: 'correct-password' },
    })

    const result = await service.authenticate('emailpass', {
      body: { email: 'auth@example.com', password: 'correct-password' },
    })

    expect(result.success).toBe(true)
    assertDefined(result.authIdentity)
    assertDefined(result.authIdentity.providerIdentities)
    expect(result.authIdentity.providerIdentities).toHaveLength(1)
    expect(result.authIdentity.providerIdentities[0]?.entityId).toBe('auth@example.com')
  })

  test('fails with wrong password', async ({ expect }) => {
    await service.register('emailpass', {
      body: { email: 'wrong@example.com', password: 'correct-password' },
    })

    const result = await service.authenticate('emailpass', {
      body: { email: 'wrong@example.com', password: 'wrong-password' },
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid email or password')
  })

  test('fails with nonexistent email', async ({ expect }) => {
    const result = await service.authenticate('emailpass', {
      body: { email: 'ghost@example.com', password: 'anything' },
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid email or password')
  })

  test('password hash never in returned data', async ({ expect }) => {
    await service.register('emailpass', {
      body: { email: 'strip@example.com', password: 'secret' },
    })

    const result = await service.authenticate('emailpass', {
      body: { email: 'strip@example.com', password: 'secret' },
    })

    expect(result.success).toBe(true)
    assertDefined(result.authIdentity)
    assertDefined(result.authIdentity.providerIdentities)
    expect(result.authIdentity.providerIdentities[0]?.providerMetadata?.password).toBeUndefined()
  })
})

test.describe('Emailpass provider — update', () => {
  test('updates password so old one stops working', async ({ expect }) => {
    await service.register('emailpass', {
      body: { email: 'update@example.com', password: 'old-password' },
    })

    const updateResult = await service.updateProvider('emailpass', {
      email: 'update@example.com',
      password: 'new-password',
    })
    expect(updateResult.success).toBe(true)
    assertDefined(updateResult.authIdentity)
    assertDefined(updateResult.authIdentity.providerIdentities)
    expect(updateResult.authIdentity.providerIdentities[0]?.providerMetadata?.password).toBeUndefined()

    const oldAuth = await service.authenticate('emailpass', {
      body: { email: 'update@example.com', password: 'old-password' },
    })
    expect(oldAuth.success).toBe(false)

    const newAuth = await service.authenticate('emailpass', {
      body: { email: 'update@example.com', password: 'new-password' },
    })
    expect(newAuth.success).toBe(true)
  })
})
