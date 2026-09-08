import { faker } from '@faker-js/faker'
import { eq, sql } from 'drizzle-orm'
import { hashPassword } from '../../../src/providers/auth-emailpass/password.js'
import type { CreateCustomer, CreateCustomerAddress } from '../../../src/schema.js'
import {
  authIdentityTable,
  authVerificationTable,
  customerAddressTable,
  customerTable,
  providerIdentityTable,
} from '../../../src/schema.js'
import { db } from '../../db/client.js'

export function generateCustomer(overrides?: Partial<CreateCustomer>): CreateCustomer {
  return {
    id: `cus_${faker.string.alphanumeric(32)}`,
    hasAccount: faker.datatype.boolean(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    status: faker.helpers.arrayElement(['active', 'inactive']),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createCustomer(overrides?: Partial<CreateCustomer>) {
  const password = faker.internet.password({ length: 12 })
  const hashedPassword = await hashPassword(password, { logN: 1, r: 1, p: 1 })

  const customerData = generateCustomer(overrides)
  const result = await db.insert(customerTable).values(customerData).returning()
  const customer = result[0]
  if (!customer) throw new Error('Customer insert returned no rows')

  const authResult = await db
    .insert(authIdentityTable)
    .values({ appMetadata: { customerId: customer.id, registered: true } })
    .returning()
  const authIdentity = authResult[0]
  if (!authIdentity) throw new Error('Auth identity insert returned no rows')

  await db.insert(providerIdentityTable).values({
    authIdentityId: authIdentity.id,
    entityId: customer.email,
    provider: 'emailpass',
    providerMetadata: { password: hashedPassword },
  })

  await db.insert(authVerificationTable).values({
    authIdentityId: authIdentity.id,
    entityId: customer.email,
    entityType: 'email',
    codeProvider: 'emailpass',
    requestedAt: new Date(),
    verifiedAt: new Date(),
  })

  return {
    ...customer,
    password,
    [Symbol.asyncDispose]: async () => {
      await deleteCustomerById(customer.id)
    },
  }
}

/** The customer with this email, or null. Signup creates the row only after verification. */
export async function retrieveCustomer(filters: { email: string }) {
  const rows = await db.select().from(customerTable).where(eq(customerTable.email, filters.email)).limit(1)
  return rows[0] ?? null
}

export async function deleteCustomerById(customerId: string) {
  await db.delete(authIdentityTable).where(sql`app_metadata->>'customerId' = ${customerId}`)
  await db.delete(customerTable).where(eq(customerTable.id, customerId))
}

// --- CustomerAddress ---

/**
 * An address in a customer's book, written straight to the table.
 *
 * The storefront's own form is the other way to make one, and it is deliberately narrow: it saves
 * addresses in the market the shopper is browsing and no other. A spec about what the book does
 * with an address from somewhere else therefore cannot type one, and this is how it gets one.
 *
 * `countryCode` has no default worth guessing, so it is required: every caller of this is here
 * because of which country the address is in.
 */
export function generateCustomerAddress(
  overrides: Partial<CreateCustomerAddress> & Pick<CreateCustomerAddress, 'customerId' | 'countryCode'>,
): CreateCustomerAddress {
  return {
    addressName: faker.location.streetAddress(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    company: null,
    address1: faker.location.streetAddress(),
    address2: null,
    city: faker.location.city(),
    province: null,
    postalCode: faker.location.zipCode(),
    phone: null,
    isDefaultShipping: false,
    isDefaultBilling: false,
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createCustomerAddress(
  overrides: Partial<CreateCustomerAddress> & Pick<CreateCustomerAddress, 'customerId' | 'countryCode'>,
) {
  const values = generateCustomerAddress(overrides)
  const result = await db.insert(customerAddressTable).values(values).returning()
  const address = result[0]
  if (!address) throw new Error('Customer address insert returned no rows')

  return {
    ...address,
    [Symbol.asyncDispose]: async () => {
      await deleteCustomerAddressById(address.id)
    },
  }
}

export async function deleteCustomerAddressById(addressId: string) {
  await db.delete(customerAddressTable).where(eq(customerAddressTable.id, addressId))
}
