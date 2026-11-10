import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { productCollectionTable, productProductCollectionTable } from '../../../src/schema.gen.js'
import { db } from '../../db/client.js'
import { fakeImageUrl } from '../image-url.js'

type CreateProductCollection = typeof productCollectionTable.$inferInsert

function generateProductCollection(overrides?: Partial<CreateProductCollection>): CreateProductCollection {
  // Handles are unique among live Collections, and E2E runs share one database.
  const title = `${faker.commerce.productAdjective()} ${faker.string.alphanumeric(6)}`
  return {
    id: `pcol_${faker.string.alphanumeric(32)}`,
    title,
    handle: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    thumbnail: fakeImageUrl(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProductCollection(overrides?: Partial<CreateProductCollection>) {
  const values = generateProductCollection(overrides)
  const result = await db.insert(productCollectionTable).values(values).returning()
  const collection = result[0]
  if (!collection) throw new Error('ProductCollection insert returned no rows')

  return {
    ...collection,
    [Symbol.asyncDispose]: async () => {
      await db.delete(productCollectionTable).where(eq(productCollectionTable.id, collection.id))
    },
  }
}

/**
 * Puts a product in a Collection. Deleting either end deletes the row with it — both references
 * cascade — so disposing the product or the Collection is enough on its own.
 */
export async function createProductProductCollection({
  productId,
  collectionId,
}: {
  productId: string
  collectionId: string
}) {
  const result = await db
    .insert(productProductCollectionTable)
    .values({ id: `ppcol_${faker.string.alphanumeric(32)}`, productId, collectionId })
    .returning()
  const membership = result[0]
  if (!membership) throw new Error('ProductProductCollection insert returned no rows')

  return {
    ...membership,
    [Symbol.asyncDispose]: async () => {
      await db.delete(productProductCollectionTable).where(eq(productProductCollectionTable.id, membership.id))
    },
  }
}
