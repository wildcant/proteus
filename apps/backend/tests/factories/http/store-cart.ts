import { faker } from '@faker-js/faker'
import type { CartAddressInputBody } from '@proteus/http-schemas/store'

/**
 * Generate a `CartAddressInputBody` — the shipping or billing address of
 * `POST /store/carts/:id`. It requires the fields a courier cannot deliver without, so a test that
 * cares only about the city still sends a whole address; it names the fields it asserts on.
 */
export function generateStoreCartAddressBody(overrides?: Partial<CartAddressInputBody>): CartAddressInputBody {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    address1: faker.location.streetAddress(),
    city: faker.location.city(),
    countryCode: faker.location.countryCode('alpha-2'),
    province: faker.location.state(),
    postalCode: faker.location.zipCode(),
    phone: faker.phone.number(),
    ...overrides,
  }
}
