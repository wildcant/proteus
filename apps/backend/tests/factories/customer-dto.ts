import type { CreateCustomerAddressDTO, CreateCustomerDTO, CustomerDTO, UpdateCustomerDTO } from '@core/types/index.js'
import { faker } from '@faker-js/faker'

/**
 * Generate a `CreateCustomerDTO` — the input shape for `createCustomers()`.
 * Pure function — no side effects.
 */
export function generateCreateCustomerDTO(overrides?: Partial<CreateCustomerDTO>): CreateCustomerDTO {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    ...overrides,
  }
}

/**
 * Generate an `UpdateCustomerDTO` — the input shape for `updateCustomers()`.
 * All fields optional; fakes them all by default.
 */
export function generateUpdateCustomerDTO(overrides?: Partial<UpdateCustomerDTO>): UpdateCustomerDTO {
  return {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    ...overrides,
  }
}

/**
 * Generate a `CreateCustomerAddressDTO` (without `customerId`) — the nested address input for `createCustomers()`.
 */
export function generateCreateCustomerAddressDTO(
  overrides?: Partial<Omit<CreateCustomerAddressDTO, 'customerId'>>,
): Omit<CreateCustomerAddressDTO, 'customerId'> {
  return {
    addressName: faker.location.secondaryAddress(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    address1: faker.location.streetAddress(),
    city: faker.location.city(),
    countryCode: faker.location.countryCode('alpha-2'),
    postalCode: faker.location.zipCode(),
    ...overrides,
  }
}

/**
 * Generate a `CustomerDTO` — the output shape returned by the service.
 * Useful for mocking repository return values in unit tests.
 */
export function generateCustomerDTO(overrides?: Partial<CustomerDTO>): CustomerDTO {
  return {
    id: `cus_${faker.string.alphanumeric(32)}`,
    hasAccount: faker.datatype.boolean(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}
