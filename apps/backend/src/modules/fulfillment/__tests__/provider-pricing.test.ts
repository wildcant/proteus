import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { vi } from 'vitest'
import { buildCascadeGraph } from '../../../core/db/cascade-graph.js'
import type {
  CalculatedShippingPrice,
  CreateProviderFulfillmentInput,
  FulfillmentOption,
} from '../../../core/types/fulfillment/provider.js'
import { AbstractFulfillmentProvider } from '../../../core/utils/abstract-fulfillment-provider.js'
import { createWithTransaction } from '../../../core/utils/with-transaction.js'
import fulfillmentModule from '../index.js'
import { FulfillmentRepository } from '../repositories/fulfillment.js'
import { FulfillmentAddressRepository } from '../repositories/fulfillment-address.js'
import { FulfillmentItemRepository } from '../repositories/fulfillment-item.js'
import { FulfillmentProviderRepository } from '../repositories/fulfillment-provider.js'
import { FulfillmentSetRepository } from '../repositories/fulfillment-set.js'
import { GeoZoneRepository } from '../repositories/geo-zone.js'
import { ServiceZoneRepository } from '../repositories/service-zone.js'
import { ShippingOptionRepository } from '../repositories/shipping-option.js'
import { ShippingOptionTypeRepository } from '../repositories/shipping-option-type.js'
import { ShippingProfileRepository } from '../repositories/shipping-profile.js'
import { FulfillmentModuleService } from '../services/fulfillment-module-service.js'
import { FulfillmentProviderService } from '../services/fulfillment-provider-service.js'

const STUB_PROVIDER = 'fp_stub_default'
const cascadeGraph = buildCascadeGraph(fulfillmentModule.models)

/**
 * A courier whose option data says which service it books: `retired` is one it can no longer
 * price at all, and `down` is one whose API is failing right now.
 */
class StubCourier extends AbstractFulfillmentProvider {
  static identifier = 'stub'

  constructor() {
    super({}, {})
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: 'stub' }]
  }

  async validateOption(): Promise<boolean> {
    return true
  }

  async canCalculate(data: Record<string, unknown>): Promise<boolean> {
    return data.service !== 'retired'
  }

  async calculatePrice(optionData: Record<string, unknown>): Promise<CalculatedShippingPrice> {
    if (optionData.service === 'down') throw new Error('Courier API unavailable')
    return { calculatedAmount: 900, isCalculatedPriceTaxInclusive: false }
  }

  async validateFulfillmentData(): Promise<Record<string, unknown>> {
    return {}
  }

  async createFulfillment(_input: CreateProviderFulfillmentInput): Promise<{ data: Record<string, unknown> }> {
    return { data: {} }
  }

  async cancelFulfillment(): Promise<void> {
    // Nothing is booked, so there is nothing to cancel.
  }
}

let service: FulfillmentModuleService

test.beforeEach(({ getDb, logger }) => {
  const container = createContainer()
  container.register(STUB_PROVIDER, asValue(new StubCourier()))
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
    fulfillmentProviderService: new FulfillmentProviderService({
      container,
      fulfillmentProviderRepository: new FulfillmentProviderRepository({ getDb, cascadeGraph }),
      logger,
    }),
    withTransaction: createWithTransaction(getDb),
    logger,
  })
})

const calculatedOption = (service: string) => ({
  name: `Courier ${service}`,
  priceType: 'calculated' as const,
  amount: null,
  providerId: STUB_PROVIDER,
  data: { service },
})

test('an update to a calculated option’s data is checked against its provider, as creation is', async ({
  factories,
  expect,
}) => {
  const option = await factories.create.shippingOptionWithZone({ shippingOption: calculatedOption('express') })

  await expect(service.updateShippingOption(option.id, { data: { service: 'retired' } })).rejects.toMatchObject({
    type: 'invalid_data',
    code: 'fulfillment_cannot_calculate',
  })
  await expect(service.updateShippingOptions([option.id], { data: { service: 'retired' } })).rejects.toMatchObject({
    code: 'fulfillment_cannot_calculate',
  })
  expect((await service.retrieveShippingOption(option.id)).data).toEqual({ service: 'express' })

  // Data the provider can still price is stored, and an edit that leaves the data alone is not checked.
  expect((await service.updateShippingOption(option.id, { data: { service: 'economy' } })).data).toEqual({
    service: 'economy',
  })
  expect((await service.updateShippingOption(option.id, { name: 'Renamed' })).name).toBe('Renamed')
})

test('a courier failing unexpectedly loses its own option from the list, logged, and not the others', async ({
  factories,
  logger,
  expect,
}) => {
  const working = await factories.create.shippingOptionWithZone({
    geoZone: { countryCode: 'co' },
    shippingOption: calculatedOption('express'),
  })
  const failing = await factories.create.shippingOptionWithZone({
    geoZone: { countryCode: 'co' },
    shippingOption: calculatedOption('down'),
  })
  const flat = await factories.create.shippingOptionWithZone({ geoZone: { countryCode: 'co' } })
  const loggedError = vi.spyOn(logger, 'error')

  const listed = await service.listPricedShippingOptionsForContext({
    currencyCode: 'cop',
    shippingAddress: { countryCode: 'co', city: 'Medellín' },
    items: [],
  })

  expect(listed.map((option) => option.id).sort()).toEqual([working.id, flat.id].sort())
  expect(listed.find((option) => option.id === working.id)?.calculatedPrice.calculatedAmount).toBe(900)
  expect(listed.map((option) => option.id)).not.toContain(failing.id)
  expect(loggedError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Courier API unavailable' }))
})
