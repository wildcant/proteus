import { buildCascadeGraph } from '../../core/db/cascade-graph.js'
import { noopLogger } from '../../core/logger/noop-logger.js'
import type { Database } from '../../schema.type.js'
import { seedProviders } from './loaders/providers.js'
import { fulfillmentTable } from './models/fulfillment.js'
import { fulfillmentAddressTable } from './models/fulfillment-address.js'
import { fulfillmentItemTable } from './models/fulfillment-item.js'
import { fulfillmentProviderTable } from './models/fulfillment-provider.js'
import { fulfillmentSetTable } from './models/fulfillment-set.js'
import { geoZoneTable } from './models/geo-zone.js'
import { serviceZoneTable } from './models/service-zone.js'
import { shippingOptionTable } from './models/shipping-option.js'
import { shippingOptionTypeTable } from './models/shipping-option-type.js'
import { shippingProfileTable } from './models/shipping-profile.js'
import { fulfillmentProviderDeclarations } from './provider-declarations.js'
import { FulfillmentProviderRepository } from './repositories/fulfillment-provider.js'
import { FulfillmentProviderService } from './services/fulfillment-provider-service.js'

const cascadeGraph = buildCascadeGraph({
  fulfillmentAddressTable,
  fulfillmentItemTable,
  fulfillmentProviderTable,
  fulfillmentSetTable,
  fulfillmentTable,
  geoZoneTable,
  serviceZoneTable,
  shippingOptionTable,
  shippingOptionTypeTable,
  shippingProfileTable,
})

export async function syncFulfillmentProviders(getDb: () => Database) {
  const fulfillmentProviderRepository = new FulfillmentProviderRepository({ getDb, cascadeGraph })
  const providerService = new FulfillmentProviderService({
    container: undefined as never,
    fulfillmentProviderRepository,
    logger: noopLogger,
  })
  await seedProviders(providerService, fulfillmentProviderDeclarations.providers)
}
