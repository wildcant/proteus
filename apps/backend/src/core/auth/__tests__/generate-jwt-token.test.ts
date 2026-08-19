import { type Fixtures, test } from '@tests/setup/test-extend.js'
import jwt from 'jsonwebtoken'
import { describe, expect, vi } from 'vitest'
import { env } from '../../../env.js'
import type { ConfigModule } from '../../config/types.js'
import type { IAuthModuleService } from '../../types/index.js'
import { generateJwtTokenForAuthIdentity, generateJwtTokenWithChecks } from '../utils/generate-jwt-token.js'

const JWT_CONFIG = { secret: env.JWT_SECRET, expiresIn: '1d' as const }

const customerVerificationConfig: ConfigModule['projectConfig']['http']['authVerificationsPerActor'] = {
  customer: [{ entityType: 'email', authProvider: 'emailpass' }],
}

function makeAuthIdentity(
  generate: Fixtures['dto']['generate'],
  overrides: Parameters<Fixtures['dto']['generate']['authIdentity']>[0] & {
    providerIdentities?: ReturnType<Fixtures['dto']['generate']['providerIdentity']>[]
  } = {},
) {
  return generate.authIdentity({ id: 'authid_123', ...overrides })
}

function makeProviderIdentity(
  generate: Fixtures['dto']['generate'],
  overrides: Parameters<Fixtures['dto']['generate']['providerIdentity']>[0] = {},
) {
  return generate.providerIdentity({
    id: 'provid_456',
    authIdentityId: 'authid_123',
    entityId: 'test@example.com',
    provider: 'emailpass',
    userMetadata: { name: 'Test User' },
    ...overrides,
  })
}

describe('generateJwtTokenForAuthIdentity', () => {
  test('generates actorless token with empty actorId', ({ dto }) => {
    const authIdentity = makeAuthIdentity(dto.generate, {
      appMetadata: { userId: 'usr_abc' },
      providerIdentities: [makeProviderIdentity(dto.generate)],
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

  test('generates full token with actorId from app_metadata', ({ dto }) => {
    const authIdentity = makeAuthIdentity(dto.generate, {
      appMetadata: { userId: 'usr_abc' },
      providerIdentities: [makeProviderIdentity(dto.generate)],
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

  test('defaults actorId to empty string when app_metadata has no actor key', ({ dto }) => {
    const authIdentity = makeAuthIdentity(dto.generate, {
      appMetadata: { registered: true },
      providerIdentities: [makeProviderIdentity(dto.generate)],
    })

    const token = generateJwtTokenForAuthIdentity(
      { authIdentity, actorType: 'user', authProvider: 'emailpass' },
      JWT_CONFIG,
    )

    const decoded = jwt.verify(token, env.JWT_SECRET) as Record<string, unknown>
    expect(decoded.actorId).toBe('')
  })

  test('uses customerId key for customer actor type', ({ dto }) => {
    const authIdentity = makeAuthIdentity(dto.generate, {
      appMetadata: { customerId: 'cus_xyz' },
      providerIdentities: [makeProviderIdentity(dto.generate)],
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
  test('returns full token when no verification required (user)', async ({ dto }) => {
    const authIdentity = makeAuthIdentity(dto.generate, {
      appMetadata: { userId: 'usr_abc' },
      providerIdentities: [makeProviderIdentity(dto.generate)],
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

  test('returns actorless token with verificationRequired when verification missing (customer)', async ({ dto }) => {
    const authIdentity = makeAuthIdentity(dto.generate, {
      appMetadata: { customerId: 'cus_xyz' },
      providerIdentities: [makeProviderIdentity(dto.generate)],
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

  test('returns full token when verification is completed (customer)', async ({ dto }) => {
    const authIdentity = makeAuthIdentity(dto.generate, {
      appMetadata: { customerId: 'cus_xyz' },
      providerIdentities: [makeProviderIdentity(dto.generate)],
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
