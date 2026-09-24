import { i18n } from '@proteus/utils'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
} from '../../../core/types/auth/provider.js'
import type { ModuleContainer } from '../../../core/types/container.js'
import type { AbstractAuthModuleProvider } from '../../../core/utils/abstract-auth-module-provider.js'

type InjectedDependencies = {
  container: ModuleContainer
}

export class AuthProviderService {
  private container: ModuleContainer

  constructor({ container }: InjectedDependencies) {
    this.container = container
  }

  retrieveProvider(providerId: string): AbstractAuthModuleProvider {
    const key = `au_${providerId}`
    try {
      return this.container.resolve<AbstractAuthModuleProvider>(key)
    } catch {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: i18n.t('Auth provider "{providerId}" is not registered'),
        values: { providerId },
      })
    }
  }

  async register(
    providerId: string,
    data: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    return this.retrieveProvider(providerId).register(data, authIdentityService)
  }

  async authenticate(
    providerId: string,
    data: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    return this.retrieveProvider(providerId).authenticate(data, authIdentityService)
  }

  async update(
    providerId: string,
    data: Record<string, unknown>,
    authIdentityService: AuthIdentityProviderService,
  ): Promise<AuthenticationResponse> {
    return this.retrieveProvider(providerId).update(data, authIdentityService)
  }
}
