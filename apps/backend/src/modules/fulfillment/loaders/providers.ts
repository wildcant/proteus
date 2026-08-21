import type { AwilixContainer } from 'awilix'
import { asValue } from 'awilix'
import type { AbstractFulfillmentProvider } from '../../../core/utils/abstract-fulfillment-provider.js'
import type { ModuleProviderExports } from '../../../core/utils/module-provider.js'
import { env } from '../../../env.js'
import { ManualFulfillmentProvider } from '../providers/manual.js'
import { FulfillmentProviderService } from '../services/fulfillment-provider-service.js'

export type FulfillmentProviderConfig = {
  resolve: ModuleProviderExports
  id: string
  options?: Record<string, unknown>
}

export type FulfillmentModuleOptions = {
  providers?: FulfillmentProviderConfig[]
}

// biome-ignore lint/suspicious/noExplicitAny: provider constructors accept varied dependency shapes
type ProviderConstructor = (new (...args: any[]) => AbstractFulfillmentProvider) & { identifier: string }

export const MANUAL_PROVIDER_KEY = 'manual_default'

export function computeProviderKeys(configs?: FulfillmentProviderConfig[]): string[] {
  const keys = [MANUAL_PROVIDER_KEY]
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

export function seedProviders(
  providerService: { upsert: (data: { id: string; isEnabled: boolean }[]) => Promise<unknown> },
  configs?: FulfillmentProviderConfig[],
) {
  const keys = computeProviderKeys(configs)
  return providerService.upsert(keys.map((key) => ({ id: `fp_${key}`, isEnabled: true })))
}

export async function loadProviders({
  container,
  options,
}: {
  container: AwilixContainer
  options?: Record<string, unknown>
}): Promise<void> {
  const opts = options as FulfillmentModuleOptions | undefined

  // 1. Always register the manual provider
  const manualProvider = new ManualFulfillmentProvider()
  container.register({ [`fp_${MANUAL_PROVIDER_KEY}`]: asValue(manualProvider) })

  // 2. Register configured providers
  if (opts?.providers) {
    for (const config of opts.providers) {
      const { resolve: providerExports, id, options: providerOptions } = config

      for (const ServiceClass of providerExports.services) {
        const Klass = ServiceClass as ProviderConstructor
        const instance = new Klass(container.cradle, providerOptions ?? {})
        container.register({ [`fp_${Klass.identifier}_${id}`]: asValue(instance) })
      }
    }
  }

  // 3. Register FulfillmentProviderService itself
  const providerService = new FulfillmentProviderService({
    container,
    fulfillmentProviderRepository: container.resolve('fulfillmentProviderRepository'),
    logger: container.resolve('logger'),
  })
  container.register({ fulfillmentProviderService: asValue(providerService) })

  // 4. Upsert provider keys to fulfillment_provider table (skip on workerd)
  if (env.RUNTIME !== 'workerd') {
    await seedProviders(providerService, opts?.providers)
  }
}
