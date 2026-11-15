import { i18n } from '@proteus/utils'
import { AppError, ErrorTypes } from '../errors/app-error.js'
import type { AppContainer, ModuleServiceContracts } from '../types/container.js'
import type { Logger } from '../types/logger.js'
import { ContainerRegistrationKeys } from '../utils/container.js'
import type { ModuleKey } from './module-key.js'

/**
 * An extension's manifest, the default export of its `extension.ts`.
 *
 * The name is the folder's name (`pisos-dj`), and every name the extension adds to a namespace core
 * also writes into carries it as a prefix. `extensions:generate` reads it without running the file
 * and fails when it differs from the folder.
 */
type ExtensionManifest = { name: string }

/**
 * @extensionApi The extension and hook API: no core code calls it until a fork does, so the production
 * unused-code pass skips it (`scripts/checks/unused.sh`).
 */
export function defineExtension<const TManifest extends ExtensionManifest>(manifest: TManifest): TManifest {
  return manifest
}

/**
 * One dev seed step, the default export of a file in an extension's `seeds/`.
 *
 * Seed steps run at the end of the dev seed, in extension-name order and then file order, against
 * the dev seed's container. They are imported only by `scripts/seed-dev.ts`, never by a runtime
 * root, so a step may read files.
 */
export type ExtensionSeedStep = (context: { container: AppContainer; logger: Logger }) => Promise<void>

/**
 * What an extension's fulfillment provider is constructed with: a `resolve` that answers module
 * services only, so it reaches its own extension's modules by their keys
 * (`resolve(PisosDjModules.SHIPPING)`) and core's by their public services. The database, the
 * logger, the link service, the bus and the other registrations the shared container holds are
 * refused, in the type and at runtime, and a module's private repositories were never on it.
 *
 * The provider is built the first time it is resolved, after every module has registered, so its
 * constructor may resolve straight away.
 */
export type ExtensionProviderDependencies = {
  resolve<TKey extends keyof ModuleServiceContracts>(key: TKey): ModuleServiceContracts[TKey]
  resolve<TService>(key: ModuleKey<TService>): TService
}

const registrationKeys: ReadonlySet<string> = new Set(Object.values(ContainerRegistrationKeys))

/**
 * Narrows the shared container to an extension provider's dependencies. Every key on the shared
 * container is either a module's or one of `ContainerRegistrationKeys`, so refusing the latter
 * leaves the module services.
 */
export function extensionProviderDependencies(container: {
  resolve(key: ModuleKey<unknown>): unknown
}): ExtensionProviderDependencies {
  function resolve<TKey extends keyof ModuleServiceContracts>(key: TKey): ModuleServiceContracts[TKey]
  function resolve<TService>(key: ModuleKey<TService>): TService
  function resolve(key: string): unknown {
    if (registrationKeys.has(key)) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: i18n.t('An extension provider may resolve module services only, not "{key}"'),
        values: { key },
      })
    }
    // The key is the provider's own, a `Modules` or extension key member; this only forwards it.
    // ast-grep-ignore: resolves-an-unlisted-container-key
    return container.resolve(key as ModuleKey<unknown>)
  }
  return { resolve }
}
