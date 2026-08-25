import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import {
  type CreateProductOption,
  type CreateProductOptionValue,
  type CreateProductProductOption,
  type CreateProductProductOptionValue,
  type CreateProductVariantOption,
  productOptionTable,
  productOptionValueTable,
  productProductOptionTable,
  productProductOptionValueTable,
  productVariantOptionTable,
} from '../../../src/schema.js'
import { db } from '../../db/client.js'

export function generateProductOption(overrides?: Partial<CreateProductOption>): CreateProductOption {
  return {
    id: `opt_${faker.string.alphanumeric(32)}`,
    // Options are globally unique by title, so tests must not collide on a plain word.
    title: `${faker.commerce.productAdjective()}-${faker.string.alphanumeric(8)}`,
    renderAs: 'text',
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProductOption(overrides?: Partial<CreateProductOption>) {
  const values = generateProductOption(overrides)
  const result = await db.insert(productOptionTable).values(values).returning()
  const option = result[0]
  if (!option) throw new Error('ProductOption insert returned no rows')

  return {
    ...option,
    [Symbol.asyncDispose]: async () => {
      await deleteProductOptionById(option.id)
    },
  }
}

export async function deleteProductOptionById(optionId: string) {
  await db.delete(productOptionTable).where(eq(productOptionTable.id, optionId))
}

export function generateProductOptionValue(overrides?: Partial<CreateProductOptionValue>): CreateProductOptionValue {
  return {
    id: `optval_${faker.string.alphanumeric(32)}`,
    optionId: `opt_${faker.string.alphanumeric(32)}`,
    value: faker.color.human(),
    rank: 0,
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProductOptionValue(overrides?: Partial<CreateProductOptionValue>) {
  const values = generateProductOptionValue(overrides)
  const result = await db.insert(productOptionValueTable).values(values).returning()
  const value = result[0]
  if (!value) throw new Error('ProductOptionValue insert returned no rows')

  return {
    ...value,
    [Symbol.asyncDispose]: async () => {
      await deleteProductOptionValueById(value.id)
    },
  }
}

export async function deleteProductOptionValueById(valueId: string) {
  await db.delete(productOptionValueTable).where(eq(productOptionValueTable.id, valueId))
}

export function generateProductProductOption(
  overrides?: Partial<CreateProductProductOption>,
): CreateProductProductOption {
  return {
    id: `prodopt_${faker.string.alphanumeric(32)}`,
    productId: `prod_${faker.string.alphanumeric(32)}`,
    optionId: `opt_${faker.string.alphanumeric(32)}`,
    rank: 0,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProductProductOption(overrides?: Partial<CreateProductProductOption>) {
  const values = generateProductProductOption(overrides)
  const result = await db.insert(productProductOptionTable).values(values).returning()
  const link = result[0]
  if (!link) throw new Error('ProductProductOption insert returned no rows')

  return {
    ...link,
    [Symbol.asyncDispose]: async () => {
      await deleteProductProductOptionById(link.id)
    },
  }
}

export async function deleteProductProductOptionById(id: string) {
  await db.delete(productProductOptionTable).where(eq(productProductOptionTable.id, id))
}

export function generateProductProductOptionValue(
  overrides?: Partial<CreateProductProductOptionValue>,
): CreateProductProductOptionValue {
  return {
    id: `prodoptval_${faker.string.alphanumeric(32)}`,
    productProductOptionId: `prodopt_${faker.string.alphanumeric(32)}`,
    optionValueId: `optval_${faker.string.alphanumeric(32)}`,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProductProductOptionValue(overrides?: Partial<CreateProductProductOptionValue>) {
  const values = generateProductProductOptionValue(overrides)
  const result = await db.insert(productProductOptionValueTable).values(values).returning()
  const link = result[0]
  if (!link) throw new Error('ProductProductOptionValue insert returned no rows')

  return {
    ...link,
    [Symbol.asyncDispose]: async () => {
      await deleteProductProductOptionValueById(link.id)
    },
  }
}

export async function deleteProductProductOptionValueById(id: string) {
  await db.delete(productProductOptionValueTable).where(eq(productProductOptionValueTable.id, id))
}

export function generateProductVariantOption(
  overrides?: Partial<CreateProductVariantOption>,
): CreateProductVariantOption {
  return {
    id: `pvopt_${faker.string.alphanumeric(32)}`,
    variantId: `variant_${faker.string.alphanumeric(32)}`,
    productProductOptionValueId: `prodoptval_${faker.string.alphanumeric(32)}`,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProductVariantOption(overrides?: Partial<CreateProductVariantOption>) {
  const values = generateProductVariantOption(overrides)
  const result = await db.insert(productVariantOptionTable).values(values).returning()
  const link = result[0]
  if (!link) throw new Error('ProductVariantOption insert returned no rows')

  return {
    ...link,
    [Symbol.asyncDispose]: async () => {
      await deleteProductVariantOptionById(link.id)
    },
  }
}

export async function deleteProductVariantOptionById(id: string) {
  await db.delete(productVariantOptionTable).where(eq(productVariantOptionTable.id, id))
}
