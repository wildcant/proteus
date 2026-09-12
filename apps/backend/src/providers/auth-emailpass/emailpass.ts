import type { AuthIdentityDTO, ProviderIdentityDTO } from '../../core/types/auth/common.js'
import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
} from '../../core/types/auth/provider.js'
import { AbstractAuthModuleProvider } from '../../core/utils/abstract-auth-module-provider.js'
import { DEFAULT_SCRYPT_CONFIG, hashPassword, type ScryptConfig, verifyPassword } from './password.js'

type EmailpassConfig = Partial<ScryptConfig>

type AuthIdentityWithProviders = AuthIdentityDTO & { providerIdentities?: ProviderIdentityDTO[] }

export class EmailpassProvider extends AbstractAuthModuleProvider<EmailpassConfig> {
  static identifier = 'emailpass'

  private scryptConfig: ScryptConfig

  constructor(container: Record<string, unknown>, config: EmailpassConfig = {}) {
    super(container, config)
    this.scryptConfig = {
      logN: config.logN ?? DEFAULT_SCRYPT_CONFIG.logN,
      r: config.r ?? DEFAULT_SCRYPT_CONFIG.r,
      p: config.p ?? DEFAULT_SCRYPT_CONFIG.p,
    }
  }

  async register(
    data: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    const { email, password } = data.body
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' }
    }

    const existing = await authIdentityService.retrieve({ entityId: email })

    // An admin may pre-create an identity (e.g. invite flow) without a password.
    // These "claimable" identities have empty/null appMetadata and get claimed here
    // when the user registers with their own password.
    if (existing) {
      const appMeta = existing.authIdentity.appMetadata
      const isClaimable = appMeta === null || (typeof appMeta === 'object' && Object.keys(appMeta).length === 0)

      if (!isClaimable) {
        return { success: false, error: 'Identity with the same email already exists' }
      }

      // Claim the identity — update password and mark as non-claimable
      const hashed = await hashPassword(password, this.scryptConfig)
      const result = await authIdentityService.update(email, {
        providerMetadata: { ...existing.providerIdentity.providerMetadata, password: hashed },
        appMetadata: { claimed: true },
      })

      return {
        success: true,
        authIdentity: this.sanitizeAuthIdentity({
          ...result.authIdentity,
          providerIdentities: [result.providerIdentity],
        }),
      }
    }

    const hashed = await hashPassword(password, this.scryptConfig)
    const result = await authIdentityService.create({
      entityId: email,
      providerMetadata: { password: hashed },
      appMetadata: { registered: true },
    })

    return {
      success: true,
      authIdentity: this.sanitizeAuthIdentity({
        ...result.authIdentity,
        providerIdentities: [result.providerIdentity],
      }),
    }
  }

  async authenticate(
    data: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    const { email, password } = data.body
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' }
    }

    // All failure paths return the same generic message to prevent email enumeration.
    const existing = await authIdentityService.retrieve({ entityId: email })
    if (!existing) {
      return { success: false, error: 'Invalid email or password' }
    }

    const storedHash = existing.providerIdentity.providerMetadata?.password
    if (typeof storedHash !== 'string') {
      return { success: false, error: 'Invalid email or password' }
    }

    const isValid = await verifyPassword(password, storedHash)
    if (!isValid) {
      return { success: false, error: 'Invalid email or password' }
    }

    return {
      success: true,
      authIdentity: this.sanitizeAuthIdentity({
        ...existing.authIdentity,
        providerIdentities: [existing.providerIdentity],
      }),
    }
  }

  async update(
    data: Record<string, unknown>,
    authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    const { email, password } = data
    if (typeof email !== 'string' || !email) {
      return { success: false, error: 'Email is required' }
    }

    const existing = await authIdentityService.retrieve({ entityId: email })
    if (!existing) {
      return { success: false, error: 'Identity not found' }
    }

    const metadata: Record<string, unknown> = { ...(existing.providerIdentity.providerMetadata ?? {}) }
    if (typeof password === 'string' && password) {
      metadata.password = await hashPassword(password, this.scryptConfig)
    }

    const result = await authIdentityService.update(email, { providerMetadata: metadata })

    return {
      success: true,
      authIdentity: this.sanitizeAuthIdentity({
        ...result.authIdentity,
        providerIdentities: [result.providerIdentity],
      }),
    }
  }

  /** Deep-clone the identity and strip the password hash so it never leaks to callers. */
  private sanitizeAuthIdentity(authIdentity: AuthIdentityWithProviders): AuthIdentityWithProviders {
    const copy: AuthIdentityWithProviders = JSON.parse(JSON.stringify(authIdentity))
    const providerIdentity = copy.providerIdentities?.find((pi) => pi.provider === this.getIdentifier())
    delete providerIdentity?.providerMetadata?.password
    return copy
  }
}
