import { faker } from '@faker-js/faker'
import type { StoreCreateAddressBody } from '@proteus/http-schemas/store'

/**
 * Generate a `StoreCreateAddressBody` — the request body for
 * `POST /store/customers/me/addresses`.
 *
 * The wire body is not the service DTO: it requires the four fields a courier cannot deliver
 * without (`address1`, `city`, `countryCode`, `postalCode`) where `CreateCustomerAddressDTO`
 * leaves every column nullable. A test asserting on `isDefault` still has to satisfy all four,
 * which is exactly the invented-value problem generators exist to remove.
 *
 * `isDefault` is deliberately omitted rather than faked. Both partial unique indexes on
 * `customer_address` allow one default per customer, so a random boolean would make any test
 * that posts two addresses fail intermittently on a constraint violation. Tests that care about
 * the flag pass it.
 */
export function generateStoreCreateAddressBody(overrides?: Partial<StoreCreateAddressBody>): StoreCreateAddressBody {
  return {
    addressName: faker.location.secondaryAddress(),
    company: faker.company.name(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    address1: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    city: faker.location.city(),
    countryCode: faker.location.countryCode('alpha-2'),
    province: faker.location.state({ abbreviated: true }),
    postalCode: faker.location.zipCode(),
    phone: faker.phone.number(),
    ...overrides,
  }
}
