import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import type { CreateStore, CreateStoreCurrency } from '../../../src/schema.js'
import { storeCurrencyTable, storeTable } from '../../../src/schema.js'
import { db } from '../../db/client.js'

// --- Store ---

export function generateStore(overrides?: Partial<CreateStore>): CreateStore {
  return {
    name: faker.company.name(),
    defaultRegionId: null,
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createStore(overrides?: Partial<CreateStore>) {
  const values = generateStore(overrides)
  const result = await db.insert(storeTable).values(values).returning()
  const store = result[0]
  if (!store) throw new Error('Store insert returned no rows')

  return {
    ...store,
    [Symbol.asyncDispose]: async () => {
      await deleteStoreById(store.id)
    },
  }
}

export async function deleteStoreById(id: string) {
  await db.delete(storeTable).where(eq(storeTable.id, id))
}

// --- StoreCurrency ---

export function generateStoreCurrency(
  overrides: Partial<CreateStoreCurrency> & Pick<CreateStoreCurrency, 'storeId'>,
): CreateStoreCurrency {
  return {
    currencyCode: faker.finance.currencyCode().toLowerCase(),
    isDefault: false,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createStoreCurrency(
  overrides: Partial<CreateStoreCurrency> & Pick<CreateStoreCurrency, 'storeId'>,
) {
  const values = generateStoreCurrency(overrides)
  const result = await db.insert(storeCurrencyTable).values(values).returning()
  const storeCurrency = result[0]
  if (!storeCurrency) throw new Error('StoreCurrency insert returned no rows')

  return {
    ...storeCurrency,
    [Symbol.asyncDispose]: async () => {
      await deleteStoreCurrencyById(storeCurrency.id)
    },
  }
}

export async function deleteStoreCurrencyById(id: string) {
  await db.delete(storeCurrencyTable).where(eq(storeCurrencyTable.id, id))
}
