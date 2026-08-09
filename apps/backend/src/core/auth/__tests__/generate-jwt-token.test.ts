import { test } from '@tests/setup/test-extend.js'
import jwt from 'jsonwebtoken'
import { describe, expect, vi } from 'vitest'
import { env } from '../../../env.js'
import type { ConfigModule } from '../../config/types.js'
import type { AuthIdentityDTO, IAuthModuleService, ProviderIdentityDTO } from '../../types/index.js'
import { generateJwtTokenForAuthIdentity, generateJwtTokenWithChecks } from '../utils/generate-jwt-token.js'

const JWT_CONFIG = { secret: env.JWT_SECRET, expiresIn: '1d' as const }

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
    userMetadata: { name: 'Test User' },
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  }
}

describe('generateJwtTokenForAuthIdentity', () => {
  test('generates actorless token with empty actorId', () => {
    const authIdentity = makeAuthIdentity({
      appMetadata: { userId: 'usr_abc' },
      providerIdentities: [makeProviderIdentity()],
    })

    const token = generateJwtTokenForAuthIdentity(
      { authIdentity, actorType: 'user', authProvider: 'emailpass' },
      JWT_CONFIG,
      { actorless: true },
    )

    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('')
    expect(decoded.actorType).toBe('user')
    expect(decoded.authIdentityId).toBe('authid_123')
    expect(decoded.authProvider).toBe('emailpass')
  })

  test('generates full token with actorId from app_metadata', () => {
    const authIdentity = makeAuthIdentity({
      appMetadata: { userId: 'usr_abc' },
      providerIdentities: [makeProviderIdentity()],
    })

    const token = generateJwtTokenForAuthIdentity(
      { authIdentity, actorType: 'user', authProvider: 'emailpass' },
      JWT_CONFIG,
    )

    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('usr_abc')
    expect(decoded.actorType).toBe('user')
    expect(decoded.userMetadata).toEqual({ name: 'Test User' })
  })

  test('defaults actorId to empty string when app_metadata has no actor key', () => {
    const authIdentity = makeAuthIdentity({
      appMetadata: { registered: true },
      providerIdentities: [makeProviderIdentity()],
    })

    const token = generateJwtTokenForAuthIdentity(
      { authIdentity, actorType: 'user', authProvider: 'emailpass' },
      JWT_CONFIG,
    )

    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('')
  })

  test('uses customerId key for customer actor type', () => {
    const authIdentity = makeAuthIdentity({
      appMetadata: { customerId: 'cus_xyz' },
      providerIdentities: [makeProviderIdentity()],
    })

    const token = generateJwtTokenForAuthIdentity(
      { authIdentity, actorType: 'customer', authProvider: 'emailpass' },
      JWT_CONFIG,
    )

    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('cus_xyz')
    expect(decoded.actorType).toBe('customer')
  })
})

describe('generateJwtTokenWithChecks', () => {
  test('returns full token when no verification required (user)', async () => {
    const authIdentity = makeAuthIdentity({
      appMetadata: { userId: 'usr_abc' },
      providerIdentities: [makeProviderIdentity()],
    })

    // Users don't have verification configured in authVerificationsPerActor
    const mockService = {
      listAuthVerifications: vi.fn().mockResolvedValue([]),
    } as unknown as IAuthModuleService

    const result = await generateJwtTokenWithChecks(
      mockService,
      { authIdentity, actorType: 'user', authProvider: 'emailpass' },
      JWT_CONFIG,
      customerVerificationConfig,
    )

    expect(result.verificationRequired).toBeUndefined()
    const decoded = jwt.verify(result.token, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('usr_abc')
  })

  test('returns actorless token with verificationRequired when verification missing (customer)', async () => {
    const authIdentity = makeAuthIdentity({
      appMetadata: { customerId: 'cus_xyz' },
      providerIdentities: [makeProviderIdentity()],
    })

    const mockService = {
      listAuthVerifications: vi.fn().mockResolvedValue([]),
    } as unknown as IAuthModuleService

    const result = await generateJwtTokenWithChecks(
      mockService,
      { authIdentity, actorType: 'customer', authProvider: 'emailpass' },
      JWT_CONFIG,
      customerVerificationConfig,
    )

    expect(result.verificationRequired).toBe(true)
    const decoded = jwt.verify(result.token, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('')
  })

  test('returns full token when verification is completed (customer)', async () => {
    const authIdentity = makeAuthIdentity({
      appMetadata: { customerId: 'cus_xyz' },
      providerIdentities: [makeProviderIdentity()],
    })

    const mockService = {
      listAuthVerifications: vi.fn().mockResolvedValue([
        {
          id: 'authver_1',
          authIdentityId: 'authid_123',
          entityId: 'test@example.com',
          entityType: 'email',
          verifiedAt: new Date(),
        },
      ]),
    } as unknown as IAuthModuleService

    const result = await generateJwtTokenWithChecks(
      mockService,
      { authIdentity, actorType: 'customer', authProvider: 'emailpass' },
      JWT_CONFIG,
      customerVerificationConfig,
    )

    expect(result.verificationRequired).toBeUndefined()
    const decoded = jwt.verify(result.token, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('cus_xyz')
  })
})
