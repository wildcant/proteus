import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import {
  type CreateProductImage,
  type CreateProductVariantImage,
  productImageTable,
  productVariantImageTable,
} from '../../../src/schema.js'
import { db } from '../../db/client.js'

export function generateProductImage(overrides?: Partial<CreateProductImage>): CreateProductImage {
  return {
    id: `img_${faker.string.alphanumeric(32)}`,
    productId: `prod_${faker.string.alphanumeric(32)}`,
    url: faker.image.url(),
    rank: 0,
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProductImage(overrides?: Partial<CreateProductImage>) {
  const values = generateProductImage(overrides)
  const result = await db.insert(productImageTable).values(values).returning()
  const image = result[0]
  if (!image) throw new Error('ProductImage insert returned no rows')

  return {
    ...image,
    [Symbol.asyncDispose]: async () => {
      await deleteProductImageById(image.id)
    },
  }
}

export async function deleteProductImageById(imageId: string) {
  await db.delete(productImageTable).where(eq(productImageTable.id, imageId))
}

export function generateProductVariantImage(overrides?: Partial<CreateProductVariantImage>): CreateProductVariantImage {
  return {
    id: `pvimg_${faker.string.alphanumeric(32)}`,
    variantId: `variant_${faker.string.alphanumeric(32)}`,
    imageId: `img_${faker.string.alphanumeric(32)}`,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createProductVariantImage(overrides?: Partial<CreateProductVariantImage>) {
  const values = generateProductVariantImage(overrides)
  const result = await db.insert(productVariantImageTable).values(values).returning()
  const link = result[0]
  if (!link) throw new Error('ProductVariantImage insert returned no rows')

  return {
    ...link,
    [Symbol.asyncDispose]: async () => {
      await deleteProductVariantImageById(link.id)
    },
  }
}

export async function deleteProductVariantImageById(id: string) {
  await db.delete(productVariantImageTable).where(eq(productVariantImageTable.id, id))
}
