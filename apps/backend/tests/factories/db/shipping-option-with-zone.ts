import { faker } from '@faker-js/faker'
import type { CreateGeoZone, CreateShippingOption } from '../../../src/schema.js'
import {
  createFulfillmentSet,
  createGeoZone,
  createServiceZone,
  createShippingOption,
  createShippingOptionType,
  createShippingProfile,
  deleteFulfillmentSetById,
  deleteShippingOptionById,
  deleteShippingOptionTypeById,
  deleteShippingProfileById,
} from './fulfillment.js'

type CreateShippingOptionWithZoneOptions = {
  geoZone?: Partial<CreateGeoZone>
  shippingOption?: Partial<CreateShippingOption>
}

/**
 * One shipping option, plus the chain that makes it offerable: a shipping profile, a fulfillment
 * set, a service zone, a geo zone and an option type. A shipping option is no more offerable
 * without a zone than a product is purchasable without a price, which is why this mirrors
 * `createProductWithPricing` — the option is spread into the return, the supporting rows hang off
 * it, and disposal unwinds the lot.
 *
 * Fulfillment providers are not created here. Those are provider registrations seeded once by
 * globalSetup via seed-providers.ts, not per-test data.
 *
 * Per test, disposed with the test. Two specs used to share one copy through `beforeAll` and
 * `afterAll`, and under `fullyParallel` one spec's teardown deleted the option the other had
 * already selected, failing the order with `Entity with id "so_..." not found`.
 *
 * The option's name is unique by default for the same reason: concurrent tests each create their
 * own US option, so the delivery step lists all of them. Select by `name` and a test can only
 * ever choose the one it created.
 */
export async function createShippingOptionWithZone(options: CreateShippingOptionWithZoneOptions = {}) {
  const shippingProfile = await createShippingProfile({ name: 'Default', type: 'default' })
  const fulfillmentSet = await createFulfillmentSet({ name: 'Default Shipping', type: 'shipping' })
  const serviceZone = await createServiceZone({ name: 'Worldwide', fulfillmentSetId: fulfillmentSet.id })
  const geoZone = await createGeoZone({
    type: 'country',
    countryCode: 'us',
    serviceZoneId: serviceZone.id,
    ...options.geoZone,
  })
  const shippingOptionType = await createShippingOptionType({
    label: 'Standard',
    description: 'Ship in 2-3 days.',
    code: 'standard',
  })
  const shippingOption = await createShippingOption({
    name: `Standard Shipping ${faker.string.alphanumeric(6)}`,
    priceType: 'flat',
    amount: 500,
    serviceZoneId: serviceZone.id,
    shippingProfileId: shippingProfile.id,
    shippingOptionTypeId: shippingOptionType.id,
    providerId: 'fp_manual_default',
    isEnabled: true,
    ...options.shippingOption,
  })

  return {
    ...shippingOption,
    shippingProfile,
    fulfillmentSet,
    serviceZone,
    geoZone,
    shippingOptionType,
    [Symbol.asyncDispose]: async () => {
      await deleteShippingOptionById(shippingOption.id)
      await deleteShippingOptionTypeById(shippingOptionType.id)
      // geo zone cascades from service zone; service zone cascades from fulfillment set
      await deleteFulfillmentSetById(fulfillmentSet.id)
      await deleteShippingProfileById(shippingProfile.id)
    },
  }
}
