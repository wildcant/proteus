import type { AwilixContainer } from 'awilix'
import { asValue } from 'awilix'
import type { AbstractPaymentProvider } from '../../../core/utils/abstract-payment-provider.js'
import type { ModuleProviderExports } from '../../../core/utils/module-provider.js'
import { env } from '../../../env.js'
import { SystemPaymentProvider } from '../providers/system.js'
import { PaymentProviderService } from '../services/payment-provider-service.js'

export type ProviderConfig = {
  resolve: ModuleProviderExports
  id: string
  options?: Record<string, unknown>
}

export type PaymentModuleOptions = {
  providers?: ProviderConfig[]
}

// biome-ignore lint/suspicious/noExplicitAny: provider constructors accept varied dependency shapes
type AnyProviderConstructor = new (...args: any[]) => AbstractPaymentProvider

type ProviderConstructor = AnyProviderConstructor & {
  identifier: string
  validateOptions?: (options: Record<string, unknown>) => void
}

export const SYSTEM_PROVIDER_KEY = 'system_default'

/** Computes the full list of provider keys (including system_default) from a config array. */
export function computeProviderKeys(configs?: ProviderConfig[]): string[] {
  const keys = [SYSTEM_PROVIDER_KEY]
  if (configs) {
    for (const config of configs) {
      for (const ServiceClass of config.resolve.services) {
        const Klass = ServiceClass as ProviderConstructor
        if (!Klass.identifier) {
          throw new Error(`Provider class ${Klass.name} is missing static "identifier" property.`)
        }
        keys.push(`${Klass.identifier}_${config.id}`)
      }
    }
  }
  return keys
}

/** Upserts all provider keys into the payment_provider table. */
export function seedProviders(
  providerService: { upsert: (data: { id: string; isEnabled: boolean }[]) => Promise<unknown> },
  configs?: ProviderConfig[],
) {
  const keys = computeProviderKeys(configs)
  return providerService.upsert(keys.map((key) => ({ id: `pp_${key}`, isEnabled: true })))
}

export async function loadProviders({
  container,
  options,
}: {
  container: AwilixContainer
  options?: Record<string, unknown>
}): Promise<void> {
  const opts = options as PaymentModuleOptions | undefined

  // 1. Always register the system provider
  const systemProvider = new SystemPaymentProvider()
  container.register({ [`pp_${SYSTEM_PROVIDER_KEY}`]: asValue(systemProvider) })

  // 2. Register configured providers
  if (opts?.providers) {
    for (const config of opts.providers) {
      const { resolve: providerExports, id, options: providerOptions } = config

      for (const ServiceClass of providerExports.services) {
        const Klass = ServiceClass as ProviderConstructor
        // Before the constructor, not inside it: a provider whose SDK client is happy to be built
        // from a blank key would otherwise register cleanly and fail at the first charge.
        Klass.validateOptions?.(providerOptions ?? {})
        const instance = new Klass(container.cradle, providerOptions ?? {})
        container.register({ [`pp_${Klass.identifier}_${id}`]: asValue(instance) })
      }
    }
  }

  // 3. Register PaymentProviderService itself (needs the container to resolve providers)
  const providerService = new PaymentProviderService({
    container,
    paymentProviderRepository: container.resolve('paymentProviderRepository'),
    logger: container.resolve('logger'),
  })
  container.register({ paymentProviderService: asValue(providerService) })

  // 4. Upsert all provider keys into the payment_provider table (skip on workerd — use seed script instead)
  if (env.RUNTIME !== 'workerd') {
    await seedProviders(providerService, opts?.providers)
  }
}
