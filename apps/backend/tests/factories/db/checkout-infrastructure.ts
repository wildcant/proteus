import { createShippingInfrastructure } from './shipping-infrastructure.js'

/**
 * Seeds the minimum fulfillment infrastructure needed for a checkout E2E test.
 * Providers (payment + fulfillment) are seeded by globalSetup via seed-providers.ts.
 */
export async function createCheckoutInfrastructure() {
  const shipping = await createShippingInfrastructure()

  return {
    ...shipping,
    [Symbol.asyncDispose]: async () => {
      await shipping[Symbol.asyncDispose]()
    },
  }
}
