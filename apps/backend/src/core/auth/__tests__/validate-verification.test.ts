import { test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import type { ConfigModule } from '../../config/types.js'
import { ErrorTypes } from '../../errors/app-error.js'
import type { AuthIdentityDTO, IAuthModuleService, ProviderIdentityDTO } from '../../types/index.js'
import { validateVerification } from '../utils/validate-verification.js'

const customerVerificationConfig: ConfigModule['projectConfig']['http']['authVerificationsPerActor'] = {
  customer: [{ entityType: 'email', authProvider: 'emailpass' }],
}

function makeAuthIdentity(overrides: Partial<AuthIdentityDTO> & { providerIdentities?: ProviderIdentityDTO[] } = {}) {
  return {
    id: 'authid_123',
    appMetadata: null as Record<string, unknown> | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }
}

function makeProviderIdentity(overrides: Partial<ProviderIdentityDTO> = {}): ProviderIdentityDTO {
  return {
    id: 'provid_456',
    authIdentityId: 'authid_123',
    entityId: 'test@example.com',
    provider: 'emailpass',
    providerMetadata: null,
    userMetadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }
}

function makeMockService(verifications: unknown[] = []) {
  return {
    listAuthVerifications: vi.fn().mockResolvedValue(verifications),
  } as unknown as IAuthModuleService
}

test.describe('validateVerification', () => {
  test('no verification required for actor type without config (user)', async ({ expect }) => {
    const mockService = makeMockService()
    const authIdentity = makeAuthIdentity({ providerIdentities: [makeProviderIdentity()] })

    const result = await validateVerification(
      mockService,
      { authIdentity, actorType: 'user', authProvider: 'emailpass' },
      customerVerificationConfig,
    )

    expect(result.verificationRequired).toBe(false)
    expect(mockService.listAuthVerifications).not.toHaveBeenCalled()
  })

  test('no verification required when auth provider not in actor config', async ({ expect }) => {
    const mockService = makeMockService()
    const authIdentity = makeAuthIdentity({
      providerIdentities: [makeProviderIdentity({ provider: 'google' })],
    })

    // customer has verification config for emailpass, but not google
    const result = await validateVerification(
      mockService,
      { authIdentity, actorType: 'customer', authProvider: 'google' },
      customerVerificationConfig,
    )

    expect(result.verificationRequired).toBe(false)
    expect(mockService.listAuthVerifications).not.toHaveBeenCalled()
  })

  test('throws when provider identity is missing', async ({ expect }) => {
    const mockService = makeMockService()
    const authIdentity = makeAuthIdentity({ providerIdentities: [] })

    await expect(
      validateVerification(
        mockService,
        { authIdentity, actorType: 'customer', authProvider: 'emailpass' },
        customerVerificationConfig,
      ),
    ).rejects.toMatchObject({ type: ErrorTypes.INVALID_DATA })
  })

  test('verification required when no verification record exists', async ({ expect }) => {
    const mockService = makeMockService([])
    const authIdentity = makeAuthIdentity({
      providerIdentities: [makeProviderIdentity()],
    })

    const result = await validateVerification(
      mockService,
      { authIdentity, actorType: 'customer', authProvider: 'emailpass' },
      customerVerificationConfig,
    )

    expect(result.verificationRequired).toBe(true)
  })

  test('verification required when verifiedAt is null', async ({ expect }) => {
    const mockService = makeMockService([
      {
        id: 'authver_1',
        authIdentityId: 'authid_123',
        entityId: 'test@example.com',
        entityType: 'email',
        verifiedAt: null,
      },
    ])
    const authIdentity = makeAuthIdentity({
      providerIdentities: [makeProviderIdentity()],
    })

    const result = await validateVerification(
      mockService,
      { authIdentity, actorType: 'customer', authProvider: 'emailpass' },
      customerVerificationConfig,
    )

    expect(result.verificationRequired).toBe(true)
  })

  test('no verification required when verification is completed', async ({ expect }) => {
    const mockService = makeMockService([
      {
        id: 'authver_1',
        authIdentityId: 'authid_123',
        entityId: 'test@example.com',
        entityType: 'email',
        verifiedAt: new Date(),
      },
    ])
    const authIdentity = makeAuthIdentity({
      providerIdentities: [makeProviderIdentity()],
    })

    const result = await validateVerification(
      mockService,
      { authIdentity, actorType: 'customer', authProvider: 'emailpass' },
      customerVerificationConfig,
    )

    expect(result.verificationRequired).toBe(false)
  })
})
