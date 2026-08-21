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

/**
 * Seeds the minimum fulfillment infrastructure for shipping options to appear during checkout.
 * Creates: shipping profile, fulfillment set, service zone, geo zone (US), shipping option type, and a shipping option.
 * Fulfillment providers are seeded by globalSetup (via seed-providers.ts) — no per-test seeding needed.
 */
export async function createShippingInfrastructure() {
  const shippingProfile = await createShippingProfile({ name: 'Default', type: 'default' })
  const fulfillmentSet = await createFulfillmentSet({ name: 'Default Shipping', type: 'shipping' })
  const serviceZone = await createServiceZone({ name: 'Worldwide', fulfillmentSetId: fulfillmentSet.id })
  const geoZone = await createGeoZone({ type: 'country', countryCode: 'us', serviceZoneId: serviceZone.id })
  const shippingOptionType = await createShippingOptionType({
    label: 'Standard',
    description: 'Ship in 2-3 days.',
    code: 'standard',
  })
  const shippingOption = await createShippingOption({
    name: 'Standard Shipping',
    priceType: 'flat',
    amount: 500,
    serviceZoneId: serviceZone.id,
    shippingProfileId: shippingProfile.id,
    shippingOptionTypeId: shippingOptionType.id,
    providerId: 'fp_manual_default',
    isEnabled: true,
  })

  return {
    shippingProfile,
    fulfillmentSet,
    serviceZone,
    geoZone,
    shippingOptionType,
    shippingOption,
    [Symbol.asyncDispose]: async () => {
      await deleteShippingOptionById(shippingOption.id)
      await deleteShippingOptionTypeById(shippingOptionType.id)
      // geo zone cascades from service zone; service zone cascades from fulfillment set
      await deleteFulfillmentSetById(fulfillmentSet.id)
      await deleteShippingProfileById(shippingProfile.id)
    },
  }
}
