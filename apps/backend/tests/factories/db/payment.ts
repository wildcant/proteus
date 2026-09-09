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

/**
 * Flips `isEnabled` on a provider row the payment module's loader already seeded.
 *
 * A test cannot register a provider of its own — the loader owns the module's private container —
 * so a *disabled* provider has to be made by disabling a real one. Doing it this way is also what
 * makes the assertion mean something: the provider is still registered and still linked, so it
 * would come back if the enabled filter stopped applying.
 */
export async function setPaymentProviderEnabled(id: string, isEnabled: boolean) {
  await db.update(paymentProviderTable).set({ isEnabled }).where(eq(paymentProviderTable.id, id))
}
