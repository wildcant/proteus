import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { loadProviders } from './loaders/providers.js'
import * as models from './models/index.js'
import { FulfillmentRepository } from './repositories/fulfillment.js'
import { FulfillmentAddressRepository } from './repositories/fulfillment-address.js'
import { FulfillmentItemRepository } from './repositories/fulfillment-item.js'
import { FulfillmentProviderRepository } from './repositories/fulfillment-provider.js'
import { FulfillmentSetRepository } from './repositories/fulfillment-set.js'
import { GeoZoneRepository } from './repositories/geo-zone.js'
import { ServiceZoneRepository } from './repositories/service-zone.js'
import { ShippingOptionRepository } from './repositories/shipping-option.js'
import { ShippingOptionTypeRepository } from './repositories/shipping-option-type.js'
import { ShippingProfileRepository } from './repositories/shipping-profile.js'
import { FulfillmentModuleService } from './services/fulfillment-module-service.js'

export { fulfillmentProviderDeclarations } from './provider-declarations.js'
export { syncFulfillmentProviders } from './sync-providers.js'

export default Module(Modules.FULFILLMENT, {
  service: FulfillmentModuleService,
  models,
  repositories: {
    fulfillmentSetRepository: FulfillmentSetRepository,
    serviceZoneRepository: ServiceZoneRepository,
    geoZoneRepository: GeoZoneRepository,
    shippingProfileRepository: ShippingProfileRepository,
    shippingOptionTypeRepository: ShippingOptionTypeRepository,
    shippingOptionRepository: ShippingOptionRepository,
    fulfillmentProviderRepository: FulfillmentProviderRepository,
    fulfillmentRepository: FulfillmentRepository,
    fulfillmentItemRepository: FulfillmentItemRepository,
    fulfillmentAddressRepository: FulfillmentAddressRepository,
  },
  loaders: [loadProviders],
})
