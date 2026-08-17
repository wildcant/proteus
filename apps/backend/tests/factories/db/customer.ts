import { faker } from '@faker-js/faker'
import { eq, sql } from 'drizzle-orm'
import { hashPassword } from '../../../src/providers/auth-emailpass/password.js'
import type { CreateCustomer } from '../../../src/schema.js'
import { authIdentityTable, authVerificationTable, customerTable, providerIdentityTable } from '../../../src/schema.js'
import { db } from '../../db/client.js'

export function generateCustomer(overrides?: Partial<CreateCustomer>): CreateCustomer {
  return {
    id: `cus_${faker.string.alphanumeric(32)}`,
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

export async function deleteCustomerById(customerId: string) {
  await db.delete(authIdentityTable).where(sql`app_metadata->>'customerId' = ${customerId}`)
  await db.delete(customerTable).where(eq(customerTable.id, customerId))
}
