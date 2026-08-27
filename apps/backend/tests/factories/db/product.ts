import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { type CreateProduct, productTable } from '../../../src/schema.js'
import { db } from '../../db/client.js'

export function generateProduct(overrides?: Partial<CreateProduct>): CreateProduct {
  const title = faker.commerce.productName()
  return {
    id: `prod_${faker.string.alphanumeric(32)}`,
    title,
    // Handles are globally unique (`idx_product_handle`), and `faker.commerce.productName()` only
    // spans ~9.7k slugs. A spec seeding a catalogue draws a dozen of them at once while the other
    // parallel specs seed their own, which collides often enough to fail a run outright.
    handle: `${faker.helpers.slugify(title).toLowerCase()}-${faker.string.alphanumeric(8)}`,
    subtitle: faker.commerce.productAdjective(),
    description: faker.commerce.productDescription(),
    isGiftcard: faker.datatype.boolean(),
    status: faker.helpers.arrayElement(['draft', 'proposed', 'published', 'rejected'] as const),
    thumbnail: faker.image.url(),
    weight: faker.number.float({ min: 0.1, max: 50, fractionDigits: 2 }),
    length: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
    height: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
    width: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
    originCountry: faker.location.countryCode(),
    hsCode: faker.string.alphanumeric(10),
    midCode: faker.string.alphanumeric(10),
    material: faker.commerce.productMaterial(),
    discountable: faker.datatype.boolean(),
    externalId: faker.string.alphanumeric(20),
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProduct(overrides?: Partial<CreateProduct>) {
  const productValues = generateProduct(overrides)
  const result = await db.insert(productTable).values(productValues).returning()
  const product = result[0]
  if (!product) throw new Error('Product insert returned no rows')

  return {
    ...product,
    [Symbol.asyncDispose]: async () => {
      await db.delete(productTable).where(eq(productTable.id, product.id))
    },
  }
}

export async function deleteProductById(productId: string) {
  await db.delete(productTable).where(eq(productTable.id, productId))
}
