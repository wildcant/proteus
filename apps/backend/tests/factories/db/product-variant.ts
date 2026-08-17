import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import { type CreateProductVariant, productVariantTable } from '../../../src/schema.js'
import { db } from '../../db/client.js'

export function generateProductVariant(overrides?: Partial<CreateProductVariant>): CreateProductVariant {
  return {
    id: `variant_${faker.string.alphanumeric(32)}`,
    productId: `prod_${faker.string.alphanumeric(32)}`,
    title: faker.commerce.productName(),
    sku: faker.string.alphanumeric(10).toUpperCase(),
    barcode: faker.string.numeric(13),
    ean: faker.string.numeric(13),
    upc: faker.string.numeric(12),
    allowBackorder: faker.datatype.boolean(),
    manageInventory: faker.datatype.boolean(),
    hsCode: faker.string.alphanumeric(10),
    originCountry: faker.location.countryCode(),
    midCode: faker.string.alphanumeric(10),
    material: faker.commerce.productMaterial(),
    weight: faker.number.float({ min: 0.1, max: 50, fractionDigits: 2 }),
    length: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
    height: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
    width: faker.number.float({ min: 1, max: 100, fractionDigits: 2 }),
    variantRank: 0,
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProductVariant(overrides?: Partial<CreateProductVariant>) {
  const productVariant = generateProductVariant(overrides)
  const result = await db.insert(productVariantTable).values(productVariant).returning()
  const variant = result[0]
  if (!variant) throw new Error('ProductVariant insert returned no rows')

  return {
    ...variant,
    [Symbol.asyncDispose]: async () => {
      await db.delete(productVariantTable).where(eq(productVariantTable.id, variant.id))
    },
  }
}
