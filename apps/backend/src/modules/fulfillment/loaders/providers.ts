import { env } from '@env'
import { asFunction, asValue } from 'awilix'
import {
  type ExtensionProviderDependencies,
  extensionProviderDependencies,
} from '../../../core/extensions/extension.js'
import type { ModuleContainer } from '../../../core/types/container.js'
import type { AbstractFulfillmentProvider } from '../../../core/utils/abstract-fulfillment-provider.js'
import { ContainerRegistrationKeys } from '../../../core/utils/container.js'
import type { ModuleProviderExports } from '../../../core/utils/module-provider.js'
import { ManualFulfillmentProvider } from '../providers/manual.js'
import { FulfillmentProviderService } from '../services/fulfillment-provider-service.js'

type FulfillmentProviderConfig = {
  resolve: ModuleProviderExports
  id: string
  options?: Record<string, unknown>
}

export type FulfillmentModuleOptions = {
  providers?: FulfillmentProviderConfig[]
  /**
   * The extensions' providers, from the extension registry. Each is registered as
   * `fp_<identifier>_default` — one instance per provider class, since an extension's settings are
   * constants in its own code rather than options passed here.
   */
  extensionProviders?: ModuleProviderExports[]
  /**
   * The shared container's resolver, narrowed to module services before an extension provider is
   * constructed with it, so it can depend on its extension's modules. Core's providers keep the
   * module's own container.
   */
  sharedContainer?: ExtensionProviderDependencies
}

// biome-ignore lint/suspicious/noExplicitAny: provider constructors accept varied dependency shapes
type ProviderConstructor = (new (...args: any[]) => AbstractFulfillmentProvider) & { identifier: string }

const MANUAL_PROVIDER_KEY = 'manual_default'

/** The id every extension provider is registered under, after its identifier. */
const EXTENSION_PROVIDER_ID = 'default'

function identifierOf(ServiceClass: unknown): string {
  const Klass = ServiceClass as ProviderConstructor
  if (!Klass.identifier) {
    throw new Error(`Provider class ${Klass.name} is missing static "identifier" property.`)
  }
  return Klass.identifier
}

function computeProviderKeys(options?: FulfillmentModuleOptions): string[] {
  return [
    MANUAL_PROVIDER_KEY,
    ...(options?.providers ?? []).flatMap((config) =>
      config.resolve.services.map((ServiceClass) => `${identifierOf(ServiceClass)}_${config.id}`),
    ),
    ...(options?.extensionProviders ?? []).flatMap((exports) =>
      exports.services.map((ServiceClass) => `${identifierOf(ServiceClass)}_${EXTENSION_PROVIDER_ID}`),
    ),
  ]
}

export function seedProviders(
  providerService: { upsert: (data: { id: string; isEnabled: boolean }[]) => Promise<unknown> },
  options?: FulfillmentModuleOptions,
) {
  const keys = computeProviderKeys(options)
  return providerService.upsert(keys.map((key) => ({ id: `fp_${key}`, isEnabled: true })))
}

export async function loadProviders({
  container,
  options,
}: {
  container: ModuleContainer
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

  // 3. Register the extensions' providers, built on first resolve: the fulfillment module boots
  // before the extension modules a provider depends on, and by the first request every one of them
  // is on the shared container.
  const sharedContainer = opts?.sharedContainer
  if (sharedContainer) {
    const dependencies = extensionProviderDependencies(sharedContainer)
    for (const ServiceClass of (opts?.extensionProviders ?? []).flatMap((exports) => exports.services)) {
      const Klass = ServiceClass as ProviderConstructor
      container.register({
        [`fp_${identifierOf(Klass)}_${EXTENSION_PROVIDER_ID}`]: asFunction(() => new Klass(dependencies)).singleton(),
      })
    }
  }

  // 4. Register FulfillmentProviderService itself
  const providerService = new FulfillmentProviderService({
    container,
    fulfillmentProviderRepository: container.resolve('fulfillmentProviderRepository'),
    logger: container.resolve(ContainerRegistrationKeys.LOGGER),
  })
  container.register({ fulfillmentProviderService: asValue(providerService) })

  // 5. Upsert provider keys to fulfillment_provider table (skip on workerd)
  if (env.RUNTIME !== 'workerd') {
    await seedProviders(providerService, opts)
  }
}
