import { faker } from '@faker-js/faker'
import BigNumber from 'bignumber.js'
import { eq } from 'drizzle-orm'
import {
  type CreatePrice,
  type CreatePriceSet,
  type CreateProductVariantPriceSet,
  priceSetTable,
  priceTable,
  productVariantPriceSetTable,
} from '../../../src/schema.js'
import { db } from '../../db/client.js'

export function generatePriceSet(overrides?: Partial<CreatePriceSet>): CreatePriceSet {
  return {
    id: `pset_${faker.string.alphanumeric(32)}`,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createPriceSet(overrides?: Partial<CreatePriceSet>) {
  const values = generatePriceSet(overrides)
  const result = await db.insert(priceSetTable).values(values).returning()
  const priceSet = result[0]
  if (!priceSet) throw new Error('PriceSet insert returned no rows')

  return {
    ...priceSet,
    [Symbol.asyncDispose]: async () => {
      await deletePriceSetById(priceSet.id)
    },
  }
}

export async function deletePriceSetById(priceSetId: string) {
  await db.delete(priceSetTable).where(eq(priceSetTable.id, priceSetId))
}

export function generatePrice(overrides?: Partial<CreatePrice>): CreatePrice {
  return {
    id: `price_${faker.string.alphanumeric(32)}`,
    currencyCode: faker.helpers.arrayElement(['usd', 'eur', 'gbp']),
    amount: new BigNumber(faker.commerce.price({ min: 1, max: 500 })),
    priceSetId: `pset_${faker.string.alphanumeric(32)}`,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createPrice(overrides?: Partial<CreatePrice>) {
  const values = generatePrice(overrides)
  const result = await db.insert(priceTable).values(values).returning()
  const price = result[0]
  if (!price) throw new Error('Price insert returned no rows')

  return {
    ...price,
    [Symbol.asyncDispose]: async () => {
      await deletePriceById(price.id)
    },
  }
}

export async function deletePriceById(priceId: string) {
  await db.delete(priceTable).where(eq(priceTable.id, priceId))
}

export function generateProductVariantPriceSet(
  overrides?: Partial<CreateProductVariantPriceSet>,
): CreateProductVariantPriceSet {
  return {
    id: `pvps_${faker.string.alphanumeric(32)}`,
    variantId: `variant_${faker.string.alphanumeric(32)}`,
    priceSetId: `pset_${faker.string.alphanumeric(32)}`,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProductVariantPriceSet(overrides?: Partial<CreateProductVariantPriceSet>) {
  const values = generateProductVariantPriceSet(overrides)
  const result = await db.insert(productVariantPriceSetTable).values(values).returning()
  const link = result[0]
  if (!link) throw new Error('ProductVariantPriceSet insert returned no rows')

  return {
    ...link,
    [Symbol.asyncDispose]: async () => {
      await deleteProductVariantPriceSetById(link.id)
    },
  }
}

export async function deleteProductVariantPriceSetById(id: string) {
  await db.delete(productVariantPriceSetTable).where(eq(productVariantPriceSetTable.id, id))
}
