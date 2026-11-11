import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { productMetafieldDefinitionTable } from '../../../src/schema.gen.js'
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
