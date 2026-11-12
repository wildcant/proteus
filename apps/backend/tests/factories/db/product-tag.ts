import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { productProductTagTable, productTagTable } from '../../../src/schema.gen.js'
import { db } from '../../db/client.js'

type CreateProductTag = typeof productTagTable.$inferInsert

function generateProductTag(overrides?: Partial<CreateProductTag>): CreateProductTag {
  return {
    id: `ptag_${faker.string.alphanumeric(32)}`,
    // Values are unique among live Tags, and E2E runs share one database.
    value: `${faker.commerce.productMaterial().toLowerCase()}-${faker.string.alphanumeric(6).toLowerCase()}`,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProductTag(overrides?: Partial<CreateProductTag>) {
  const values = generateProductTag(overrides)
  const result = await db.insert(productTagTable).values(values).returning()
  const tag = result[0]
  if (!tag) throw new Error('ProductTag insert returned no rows')

  return {
    ...tag,
    [Symbol.asyncDispose]: async () => {
      await db.delete(productTagTable).where(eq(productTagTable.id, tag.id))
    },
  }
}

/**
 * Tags a product. Deleting either end deletes the row with it — both references cascade — so
 * disposing the product or the Tag is enough on its own.
 */
export async function createProductProductTag({ productId, tagId }: { productId: string; tagId: string }) {
  const result = await db
    .insert(productProductTagTable)
    .values({ id: `pptag_${faker.string.alphanumeric(32)}`, productId, tagId })
    .returning()
  const tagging = result[0]
  if (!tagging) throw new Error('ProductProductTag insert returned no rows')

  return {
    ...tagging,
    [Symbol.asyncDispose]: async () => {
      await db.delete(productProductTagTable).where(eq(productProductTagTable.id, tagging.id))
    },
  }
}
