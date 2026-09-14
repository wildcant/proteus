import { faker } from '@faker-js/faker'
import type { AdminCreateOrderFulfillmentBody } from '@proteus/http-schemas/admin'

/**
 * Generate an `AdminCreateOrderFulfillmentBody` — the request body for
 * `POST /admin/orders/:id/fulfillments`.
 *
 * `items` is deliberately empty rather than faked: every entry has to name a line item of the
 * order being fulfilled, and the route refuses a request that does not cover all of them, so an
 * invented id fails on the wrong assertion. The schema requires at least one, so every caller
 * passes its own — what the generator saves them is the provider and the ship-to address around it.
 *
 * `locationId` is omitted for the same reason and one more: absent is the ordinary case, since the
 * server resolves it from the order's reservations.
 */
export function generateAdminCreateOrderFulfillmentBody(
  overrides?: Partial<AdminCreateOrderFulfillmentBody>,
): AdminCreateOrderFulfillmentBody {
  return {
    // The one fulfillment provider the container registers; a faked id resolves to nothing.
    providerId: 'manual',
    items: [],
    address: {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      address1: faker.location.streetAddress(),
      city: faker.location.city(),
      countryCode: faker.location.countryCode('alpha-2'),
      postalCode: faker.location.zipCode(),
    },
    ...overrides,
  }
}
