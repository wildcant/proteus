import { Module } from '../../core/utils/module.js'
import { Modules } from '../../core/utils/modules-definition.js'
import { loadProviders } from './loaders/providers.js'
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

export default Module(Modules.FULFILLMENT, {
  service: FulfillmentModuleService,
  models: {
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
  },
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
