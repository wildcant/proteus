import { test } from '@tests/setup/test-extend.js'
import { buildCascadeGraph } from '../../../core/db/cascade-graph.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import * as models from '../models/index.js'
import { FulfillmentRepository } from '../repositories/fulfillment.js'
import { FulfillmentAddressRepository } from '../repositories/fulfillment-address.js'
import { FulfillmentItemRepository } from '../repositories/fulfillment-item.js'
import { FulfillmentSetRepository } from '../repositories/fulfillment-set.js'
import { GeoZoneRepository } from '../repositories/geo-zone.js'
import { ServiceZoneRepository } from '../repositories/service-zone.js'
import { ShippingOptionRepository } from '../repositories/shipping-option.js'
import { ShippingOptionTypeRepository } from '../repositories/shipping-option-type.js'
import { ShippingProfileRepository } from '../repositories/shipping-profile.js'
import { FulfillmentModuleService } from '../services/fulfillment-module-service.js'
import type { FulfillmentProviderService } from '../services/fulfillment-provider-service.js'

const cascadeGraph = buildCascadeGraph(models)

let service: FulfillmentModuleService

test.beforeEach(({ getDb, logger }) => {
  service = new FulfillmentModuleService({
    fulfillmentSetRepository: new FulfillmentSetRepository({ getDb, cascadeGraph }),
    serviceZoneRepository: new ServiceZoneRepository({ getDb, cascadeGraph }),
    geoZoneRepository: new GeoZoneRepository({ getDb, cascadeGraph }),
    shippingProfileRepository: new ShippingProfileRepository({ getDb, cascadeGraph }),
    shippingOptionTypeRepository: new ShippingOptionTypeRepository({ getDb, cascadeGraph }),
    shippingOptionRepository: new ShippingOptionRepository({ getDb, cascadeGraph }),
    fulfillmentRepository: new FulfillmentRepository({ getDb, cascadeGraph }),
    fulfillmentItemRepository: new FulfillmentItemRepository({ getDb, cascadeGraph }),
    fulfillmentAddressRepository: new FulfillmentAddressRepository({ getDb, cascadeGraph }),
    // Nothing here reaches a provider; the cascade is entirely between our own tables.
    fulfillmentProviderService: undefined as unknown as FulfillmentProviderService,
    withTransaction: createWithTransaction(getDb),
    logger,
  })
})

test.describe('FulfillmentModuleService', () => {
  // ---------------------------------------------------------------------------
  // Cascade delete
  //
  // Fulfillment set → service zone → geo zone is the deepest chain in the schema and cascaded to
  // nothing before the walker existed.
  // ---------------------------------------------------------------------------

  test.describe('Cascade delete', () => {
    test('softDeleteFulfillmentSets — hides its service zones and their geo zones', async ({ expect, dto }) => {
      const set = await service.createFulfillmentSet(dto.generate.createFulfillmentSet())
      const zone = await service.createServiceZone(
        dto.generate.createServiceZone(set.id, { geoZones: [dto.generate.createGeoZone()] }),
      )

      await service.softDeleteFulfillmentSets([set.id])

      expect(await service.listFulfillmentSets({ id: set.id })).toHaveLength(0)
      expect(await service.listServiceZones({ fulfillmentSetId: set.id })).toHaveLength(0)
      expect(await service.listGeoZones({ serviceZoneId: zone.id })).toHaveLength(0)
    })

    test('softDeleteFulfillmentSets — leaves another set and its zones alone', async ({ expect, dto }) => {
      const deleted = await service.createFulfillmentSet(dto.generate.createFulfillmentSet())
      await service.createServiceZone(
        dto.generate.createServiceZone(deleted.id, { geoZones: [dto.generate.createGeoZone()] }),
      )

      const kept = await service.createFulfillmentSet(dto.generate.createFulfillmentSet())
      const keptZone = await service.createServiceZone(
        dto.generate.createServiceZone(kept.id, { geoZones: [dto.generate.createGeoZone()] }),
      )

      await service.softDeleteFulfillmentSets([deleted.id])

      expect(await service.listServiceZones({ fulfillmentSetId: kept.id })).toHaveLength(1)
      expect(await service.listGeoZones({ serviceZoneId: keptZone.id })).toHaveLength(1)
    })
  })
})
