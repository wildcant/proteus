import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { asValue, createContainer } from 'awilix'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import { AuthIdentityRepository } from '../repositories/auth-identity.js'
import { AuthPasswordResetTokenRepository } from '../repositories/auth-password-reset-token.js'
import { AuthVerificationRepository } from '../repositories/auth-verification.js'
import { ProviderIdentityRepository } from '../repositories/provider-identity.js'
import { AuthModuleService } from '../services/auth-module-service.js'
import { AuthProviderService } from '../services/auth-provider-service.js'
import { VerificationProviderService } from '../services/verification-provider-service.js'

let service: AuthModuleService

test.beforeEach(({ getDb, logger }) => {
  const authIdentityRepository = new AuthIdentityRepository({ getDb })
  const providerIdentityRepository = new ProviderIdentityRepository({ getDb })
  const authVerificationRepository = new AuthVerificationRepository({ getDb })
  const authPasswordResetTokenRepository = new AuthPasswordResetTokenRepository({ getDb })
  const withTransaction = createWithTransaction(getDb)
  const container = createContainer()
  container.register({ placeholder: asValue(null) })
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

test.describe('AuthModuleService — AuthIdentity', () => {
  test('createAuthIdentities', async ({ expect, dto }) => {
    const input = [dto.generate.createAuthIdentity(), dto.generate.createAuthIdentity()]

    const result = await service.createAuthIdentities(input)

    expect(result).toHaveLength(2)
    expect(result[0]?.id).toMatch(/^authid_/)
    expect(result[0]?.createdAt).toBeInstanceOf(Date)
  })

  test('retrieveAuthIdentity', async ({ expect, dto }) => {
    const created = await service.createAuthIdentity(dto.generate.createAuthIdentity())

    const result = await service.retrieveAuthIdentity(created.id)

    expect(result.id).toBe(created.id)
  })

  test('listAuthIdentities', async ({ expect, dto }) => {
    await service.createAuthIdentities([
      dto.generate.createAuthIdentity(),
      dto.generate.createAuthIdentity(),
      dto.generate.createAuthIdentity(),
    ])

    const result = await service.listAuthIdentities()

    expect(result).toHaveLength(3)
  })

  test('listAndCountAuthIdentities', async ({ expect, dto }) => {
    await service.createAuthIdentities([dto.generate.createAuthIdentity(), dto.generate.createAuthIdentity()])

    const [rows, count] = await service.listAndCountAuthIdentities()

    expect(rows).toHaveLength(2)
    expect(count).toBe(2)
  })

  test('updateAuthIdentity', async ({ expect, dto }) => {
    const created = await service.createAuthIdentity(dto.generate.createAuthIdentity())

    const updated = await service.updateAuthIdentity(created.id, { appMetadata: { role: 'admin' } })

    expect(updated.appMetadata).toEqual({ role: 'admin' })
    expect(updated.id).toBe(created.id)
  })

  test('deleteAuthIdentities', async ({ expect, dto }) => {
    const created = await service.createAuthIdentity(dto.generate.createAuthIdentity())

    await service.deleteAuthIdentities([created.id])

    const error = await service.retrieveAuthIdentity(created.id).catch((e) => e)
    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_FOUND)
  })

  test('softDeleteAuthIdentities', async ({ expect, dto }) => {
    const created = await service.createAuthIdentity(dto.generate.createAuthIdentity())

    await service.softDeleteAuthIdentities([created.id])

    const list = await service.listAuthIdentities()
    expect(list).toHaveLength(0)
  })

  test('restoreAuthIdentities', async ({ expect, dto }) => {
    const created = await service.createAuthIdentity(dto.generate.createAuthIdentity())
    await service.softDeleteAuthIdentities([created.id])

    await service.restoreAuthIdentities([created.id])

    const list = await service.listAuthIdentities()
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe(created.id)
  })
})

test.describe('AuthModuleService — ProviderIdentity', () => {
  test('CRUD on provider_identity', async ({ expect, dto }) => {
    // Create parent auth identity
    const authIdentity = await service.createAuthIdentity(dto.generate.createAuthIdentity())

    // Create
    const created = await service.createProviderIdentity(
      dto.generate.createProviderIdentity({ authIdentityId: authIdentity.id }),
    )
    expect(created.id).toMatch(/^provid_/)
    expect(created.authIdentityId).toBe(authIdentity.id)

    // Retrieve
    const retrieved = await service.retrieveProviderIdentity(created.id)
    expect(retrieved.id).toBe(created.id)

    // List
    const list = await service.listProviderIdentities()
    expect(list).toHaveLength(1)

    // Update
    const updated = await service.updateProviderIdentity(created.id, {
      providerMetadata: { passwordHash: 'abc123' },
    })
    expect(updated.providerMetadata).toEqual({ passwordHash: 'abc123' })

    // Soft delete
    await service.softDeleteProviderIdentities([created.id])
    const afterSoftDelete = await service.listProviderIdentities()
    expect(afterSoftDelete).toHaveLength(0)

    // Restore
    await service.restoreProviderIdentities([created.id])
    const afterRestore = await service.listProviderIdentities()
    expect(afterRestore).toHaveLength(1)

    // Hard delete
    await service.deleteProviderIdentities([created.id])
    const error = await service.retrieveProviderIdentity(created.id).catch((e) => e)
    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.NOT_FOUND)
  })

  test('unique constraint on (entity_id, provider)', async ({ expect, dto }) => {
    const authIdentity = await service.createAuthIdentity(dto.generate.createAuthIdentity())
    const entityId = 'shared@example.com'

    await service.createProviderIdentity(
      dto.generate.createProviderIdentity({ authIdentityId: authIdentity.id, entityId, provider: 'email-password' }),
    )

    const error = await service
      .createProviderIdentity(
        dto.generate.createProviderIdentity({ authIdentityId: authIdentity.id, entityId, provider: 'email-password' }),
      )
      .catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.DUPLICATE_ERROR)
  })

  test('unique constraint allows same entity_id with different provider', async ({ expect, dto }) => {
    const authIdentity = await service.createAuthIdentity(dto.generate.createAuthIdentity())
    const entityId = 'shared@example.com'

    await service.createProviderIdentity(
      dto.generate.createProviderIdentity({ authIdentityId: authIdentity.id, entityId, provider: 'email-password' }),
    )

    const second = await service.createProviderIdentity(
      dto.generate.createProviderIdentity({ authIdentityId: authIdentity.id, entityId, provider: 'google' }),
    )

    expect(second.id).toMatch(/^provid_/)
  })
})

test.describe('AuthModuleService — AuthVerification', () => {
  test('CRUD on auth_verification', async ({ expect, dto }) => {
    const authIdentity = await service.createAuthIdentity(dto.generate.createAuthIdentity())

    // Create
    const created = await service.createAuthVerification(
      dto.generate.createAuthVerification({ authIdentityId: authIdentity.id }),
    )
    expect(created.id).toMatch(/^authver_/)
    expect(created.verifiedAt).toBeNull()

    // Update (mark verified)
    const updated = await service.updateAuthVerification(created.id, { verifiedAt: new Date() })
    expect(updated.verifiedAt).toBeInstanceOf(Date)

    // List & count
    const [rows, count] = await service.listAndCountAuthVerifications()
    expect(rows).toHaveLength(1)
    expect(count).toBe(1)

    // Soft delete + restore
    await service.softDeleteAuthVerifications([created.id])
    expect(await service.listAuthVerifications()).toHaveLength(0)
    await service.restoreAuthVerifications([created.id])
    expect(await service.listAuthVerifications()).toHaveLength(1)

    // Hard delete
    await service.deleteAuthVerifications([created.id])
    const error = await service.retrieveAuthVerification(created.id).catch((e) => e)
    expect(AppError.isError(error)).toBe(true)
  })

  test('unique constraint on (auth_identity_id, entity_id, entity_type)', async ({ expect, dto }) => {
    const authIdentity = await service.createAuthIdentity(dto.generate.createAuthIdentity())
    const shared = { authIdentityId: authIdentity.id, entityId: 'user@example.com', entityType: 'email' }

    await service.createAuthVerification(dto.generate.createAuthVerification(shared))

    const error = await service.createAuthVerification(dto.generate.createAuthVerification(shared)).catch((e) => e)

    expect(AppError.isError(error)).toBe(true)
    expect(error.type).toBe(ErrorTypes.DUPLICATE_ERROR)
  })
})

test.describe('AuthModuleService — AuthPasswordResetToken', () => {
  test('create and find by token hash', async ({ expect, dto }) => {
    const authIdentity = await service.createAuthIdentity(dto.generate.createAuthIdentity())
    const providerIdentity = await service.createProviderIdentity(
      dto.generate.createProviderIdentity({ authIdentityId: authIdentity.id }),
    )

    const tokenHash = 'abc123hash'
    const token = await service.createAuthPasswordResetToken(
      dto.generate.createAuthPasswordResetToken({
        authIdentityId: authIdentity.id,
        providerIdentityId: providerIdentity.id,
        tokenHash,
      }),
    )

    expect(token.id).toMatch(/^authprt_/)
    expect(token.tokenHash).toBe(tokenHash)

    const found = await service.findAuthPasswordResetTokenByHash(tokenHash)
    assertDefined(found)
    expect(found.id).toBe(token.id)
  })

  test('findByTokenHash returns null for non-existent hash', async ({ expect }) => {
    const result = await service.findAuthPasswordResetTokenByHash('nonexistent')
    expect(result).toBeNull()
  })

  test('deleteByProviderIdentity removes all tokens for that provider', async ({ expect, dto }) => {
    const authIdentity = await service.createAuthIdentity(dto.generate.createAuthIdentity())
    const providerIdentity = await service.createProviderIdentity(
      dto.generate.createProviderIdentity({ authIdentityId: authIdentity.id }),
    )

    const hash1 = 'hash_one'
    const hash2 = 'hash_two'
    await service.createAuthPasswordResetToken(
      dto.generate.createAuthPasswordResetToken({
        authIdentityId: authIdentity.id,
        providerIdentityId: providerIdentity.id,
        tokenHash: hash1,
      }),
    )
    await service.createAuthPasswordResetToken(
      dto.generate.createAuthPasswordResetToken({
        authIdentityId: authIdentity.id,
        providerIdentityId: providerIdentity.id,
        tokenHash: hash2,
      }),
    )

    await service.deleteAuthPasswordResetTokensByProviderIdentity(providerIdentity.id)

    expect(await service.findAuthPasswordResetTokenByHash(hash1)).toBeNull()
    expect(await service.findAuthPasswordResetTokenByHash(hash2)).toBeNull()
  })

  test('hardDelete removes token permanently', async ({ expect, dto }) => {
    const authIdentity = await service.createAuthIdentity(dto.generate.createAuthIdentity())
    const providerIdentity = await service.createProviderIdentity(
      dto.generate.createProviderIdentity({ authIdentityId: authIdentity.id }),
    )

    const tokenHash = 'to_be_deleted'
    const token = await service.createAuthPasswordResetToken(
      dto.generate.createAuthPasswordResetToken({
        authIdentityId: authIdentity.id,
        providerIdentityId: providerIdentity.id,
        tokenHash,
      }),
    )

    await service.hardDeleteAuthPasswordResetToken(token.id)

    expect(await service.findAuthPasswordResetTokenByHash(tokenHash)).toBeNull()
  })
})
