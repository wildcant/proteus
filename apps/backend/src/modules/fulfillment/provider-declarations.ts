import type { FulfillmentModuleOptions } from './loaders/providers.js'

/**
 * Single source of truth for which fulfillment providers are configured.
 * The manual provider is always built-in; external providers go here.
 */
export const fulfillmentProviderDeclarations: FulfillmentModuleOptions = {
  providers: [],
}
