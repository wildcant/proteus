import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { type CreateStockLocation, stockLocationTable } from '../../../src/schema.gen.js'
import { db } from '../../db/client.js'

export function generateStockLocation(overrides?: Partial<CreateStockLocation>): CreateStockLocation {
  return {
    name: `${faker.location.city()} Warehouse`,
    ...overrides,
  }
}

export async function createStockLocation(overrides?: Partial<CreateStockLocation>) {
  const values = generateStockLocation(overrides)
  const [location] = await db.insert(stockLocationTable).values(values).returning()
  if (!location) throw new Error('StockLocation insert returned no rows')

  return {
    ...location,
    [Symbol.asyncDispose]: async () => {
      await deleteStockLocationById(location.id)
    },
  }
}

export async function deleteStockLocationById(id: string) {
  await db.delete(stockLocationTable).where(eq(stockLocationTable.id, id))
}
