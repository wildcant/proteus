import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { productCategoryTable, productProductCategoryTable } from '../../../src/schema.gen.js'
import { db } from '../../db/client.js'

type CreateProductCategory = typeof productCategoryTable.$inferInsert

export function generateProductCategory(overrides?: Partial<CreateProductCategory>): CreateProductCategory {
  // Handles are unique among live Categories, and E2E runs share one database.
  const name = `${faker.commerce.department()} ${faker.string.alphanumeric(6)}`
  return {
    id: `pcat_${faker.string.alphanumeric(32)}`,
    name,
    description: '',
    handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    parentId: null,
    rank: 0,
    isActive: true,
    isInternal: false,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

/** Inserted as given: the rank is not renumbered, so pass distinct ranks for siblings. */
export async function createProductCategory(overrides?: Partial<CreateProductCategory>) {
  const values = generateProductCategory(overrides)
  const result = await db.insert(productCategoryTable).values(values).returning()
  const category = result[0]
  if (!category) throw new Error('ProductCategory insert returned no rows')

  return {
    ...category,
    // Dispose children before their parent: `parent_id` restricts deleting a Category with children.
    [Symbol.asyncDispose]: async () => {
      await deleteProductCategoryById(category.id)
    },
  }
}

export async function deleteProductCategoryById(categoryId: string) {
  await db.delete(productCategoryTable).where(eq(productCategoryTable.id, categoryId))
}

/**
 * Puts a product directly in a Category. Deleting either end deletes the row with it — both
 * references cascade — so disposing the product or the Category is enough on its own.
 */
export async function createProductProductCategory({
  productId,
  categoryId,
}: {
  productId: string
  categoryId: string
}) {
  const result = await db
    .insert(productProductCategoryTable)
    .values({ id: `ppcat_${faker.string.alphanumeric(32)}`, productId, categoryId })
    .returning()
  const membership = result[0]
  if (!membership) throw new Error('ProductProductCategory insert returned no rows')

  return {
    ...membership,
    [Symbol.asyncDispose]: async () => {
      await db.delete(productProductCategoryTable).where(eq(productProductCategoryTable.id, membership.id))
    },
  }
}
