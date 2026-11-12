import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { productMetafieldDefinitionTable, productMetafieldTable } from '../../../src/schema.gen.js'
import { db } from '../../db/client.js'

type CreateProductMetafieldDefinition = typeof productMetafieldDefinitionTable.$inferInsert

function generateProductMetafieldDefinition(
  overrides?: Partial<CreateProductMetafieldDefinition>,
): CreateProductMetafieldDefinition {
  return {
    id: `pmfd_${faker.string.alphanumeric(32)}`,
    // Keys are unique among live definitions, and E2E runs share one database.
    key: `${faker.word.noun().toLowerCase()}_${faker.string.alphanumeric({ length: 6, casing: 'lower' })}`,
    name: faker.word.noun(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

/** A `custom` list metafield, as a structure file's `campos` would define it. Disposing deletes its values with it. */
export async function createProductMetafieldDefinition(overrides?: Partial<CreateProductMetafieldDefinition>) {
  const values = generateProductMetafieldDefinition(overrides)
  const result = await db.insert(productMetafieldDefinitionTable).values(values).returning()
  const definition = result[0]
  if (!definition) throw new Error('ProductMetafieldDefinition insert returned no rows')

  return {
    ...definition,
    [Symbol.asyncDispose]: async () => {
      await db.delete(productMetafieldDefinitionTable).where(eq(productMetafieldDefinitionTable.id, definition.id))
    },
  }
}

/**
 * Gives a product's metafield its values, one row each, in order. Deleting the product or the
 * definition deletes them with it — both references cascade — so disposing either is enough.
 */
export async function createProductMetafield({
  productId,
  definitionId,
  values,
}: {
  productId: string
  definitionId: string
  values: string[]
}) {
  const rows = await db
    .insert(productMetafieldTable)
    .values(
      values.map((value, position) => ({
        id: `pmf_${faker.string.alphanumeric(32)}`,
        productId,
        definitionId,
        value,
        position,
      })),
    )
    .returning()

  return {
    rows,
    [Symbol.asyncDispose]: async () => {
      await Promise.all(rows.map((row) => db.delete(productMetafieldTable).where(eq(productMetafieldTable.id, row.id))))
    },
  }
}
