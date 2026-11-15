import type { ExtensionProviderDependencies } from '../../core/extensions/extension.js'
import type { ModuleProviderExports } from '../../core/utils/module-provider.js'
import type { FulfillmentModuleOptions } from './loaders/providers.js'

/**
 * Single source of truth for which fulfillment providers are configured, read by the container and
 * by the out-of-band sync. The manual provider is always built-in; external providers go in
 * `providers`. The extensions' providers come from the extension registry, which the caller passes,
 * so this file never names an extension.
 */
export function fulfillmentProviderDeclarations(
  extensionProviders: ModuleProviderExports[],
  sharedContainer?: ExtensionProviderDependencies,
): FulfillmentModuleOptions {
  return { providers: [], extensionProviders, ...(sharedContainer ? { sharedContainer } : {}) }
}
