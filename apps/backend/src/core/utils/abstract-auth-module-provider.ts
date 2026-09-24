import { i18n } from '@proteus/utils'
import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
  IAuthModuleProvider,
} from '../types/auth/provider.js'

/**
 * Abstract base class for auth module providers.
 *
 * Subclasses must set a static `identifier` string and override the methods
 * they support. Default implementations return `{ success: false, error: "… not supported" }`.
 *
 * The provider's registration key in the local container is `au_{identifier}`.
 *
 * @typeParam TConfig - Shape of the provider's options (e.g. `{ logN: number }`).
 */
export abstract class AbstractAuthModuleProvider<TConfig = Record<string, unknown>> implements IAuthModuleProvider {
  static identifier: string

  protected config: TConfig
  protected container: Record<string, unknown>

  constructor(container: Record<string, unknown>, config: TConfig) {
    this.container = container
    this.config = config
  }

  getIdentifier(): string {
    const ctr = this.constructor as typeof AbstractAuthModuleProvider
    if (!ctr.identifier) {
      throw new Error('Missing static property "identifier".')
    }
    return ctr.identifier
  }

  async register(
    _data: AuthenticationInput,
    _authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    return { success: false, error: i18n.t('This authentication provider does not support register') }
  }

  async authenticate(
    _data: AuthenticationInput,
    _authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    return { success: false, error: i18n.t('This authentication provider does not support authenticate') }
  }

  async update(
    _data: Record<string, unknown>,
    _authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    return { success: false, error: i18n.t('This authentication provider does not support update') }
  }

  async validateCallback(
    _data: AuthenticationInput,
    _authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    return { success: false, error: i18n.t('This authentication provider does not support validateCallback') }
  }
}
