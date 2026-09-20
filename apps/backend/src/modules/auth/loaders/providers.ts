import type { AwilixContainer } from 'awilix'
import { asValue } from 'awilix'
import type { AuthModuleOptions } from '../../../core/types/auth/provider.js'
import type { AbstractAuthModuleProvider } from '../../../core/utils/abstract-auth-module-provider.js'
import type { AbstractAuthVerificationProvider } from '../../../core/utils/abstract-auth-verification-provider.js'
import { AuthProviderService } from '../services/auth-provider-service.js'
import { VerificationProviderService } from '../services/verification-provider-service.js'

type ProviderConstructor = new (
  container: Record<string, unknown>,
  config: Record<string, unknown>,
) => AbstractAuthModuleProvider

type VerificationProviderConstructor = new (
  container: Record<string, unknown>,
  config: Record<string, unknown>,
) => AbstractAuthVerificationProvider

export async function loadAuthProviders({
  container,
  options,
}: {
  container: AwilixContainer
  options?: Record<string, unknown>
}): Promise<void> {
  // options is Record<string, unknown> at the module-framework boundary; narrow here
  const opts = options as AuthModuleOptions | undefined

  if (opts?.providers) {
    for (const config of opts.providers) {
      for (const ServiceClass of config.resolve.services) {
        const Klass = ServiceClass as ProviderConstructor
        const instance = new Klass(container.cradle, config.options ?? {})
        container.register({ [`au_${config.id}`]: asValue(instance) })
      }
    }
  }

  if (opts?.verification?.providers) {
    for (const config of opts.verification.providers) {
      for (const ServiceClass of config.resolve.services) {
        const Klass = ServiceClass as VerificationProviderConstructor
        const instance = new Klass(container.cradle, config.options ?? {})
        container.register({ [`verif_${config.id}`]: asValue(instance) })
      }
    }
  }

  const authProviderService = new AuthProviderService({ container })
  container.register({ authProviderService: asValue(authProviderService) })

  const verificationProviderService = new VerificationProviderService({ container })
  container.register({ verificationProviderService: asValue(verificationProviderService) })
}
