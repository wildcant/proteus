import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import type { CreatePaymentProvider } from '../../../src/schema.js'
import { paymentProviderTable } from '../../../src/schema.js'
import { db } from '../../db/client.js'

// --- PaymentProvider ---

export function generatePaymentProvider(overrides?: Partial<CreatePaymentProvider>): CreatePaymentProvider {
  return {
    id: `pp_${faker.string.alphanumeric(20)}`,
    isEnabled: faker.datatype.boolean(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createPaymentProvider(overrides?: Partial<CreatePaymentProvider>) {
  const values = generatePaymentProvider(overrides)
  const result = await db.insert(paymentProviderTable).values(values).returning()
  const paymentProvider = result[0]
  if (!paymentProvider) throw new Error('PaymentProvider insert returned no rows')

  return {
    ...paymentProvider,
    [Symbol.asyncDispose]: async () => {
      await deletePaymentProviderById(paymentProvider.id)
    },
  }
}

export async function deletePaymentProviderById(id: string) {
  await db.delete(paymentProviderTable).where(eq(paymentProviderTable.id, id))
}
