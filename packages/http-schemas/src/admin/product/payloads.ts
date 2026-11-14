import { z } from 'zod'
import { entityId, handle, httpUrl, longText, MAX_ITEMS, machineCode, shortText } from '../../bounded.js'
import { AdminSetProductOptionEntry } from '../product-option/payloads.js'
import { AdminCreateProductVariant } from '../product-variant/payloads.js'
import { ProductStatus } from './entities.js'

const AdminCreateProductImage = z.object({ url: httpUrl.min(1) })

export const AdminUpsertProductImage = z.object({ id: entityId.optional(), url: httpUrl.min(1) })

export const AdminCreateProduct = z
  .object({
    /** The product's Categories. An unknown id answers `NOT_FOUND`. */
    categoryIds: z.array(entityId).max(MAX_ITEMS.batch).optional(),
    /** The product's Collections. An unknown id answers `NOT_FOUND`. */
    collectionIds: z.array(entityId).max(MAX_ITEMS.batch).optional(),
    description: longText.optional(),
    discountable: z.boolean().optional(),
    /** The product's storefront URL, `/products/<handle>`. Omitted, it is derived from the title. */
    handle: handle.optional(),
    height: z.number().nullable().optional(),
    hsCode: machineCode.optional(),
    images: z.array(AdminCreateProductImage).max(MAX_ITEMS.batch).optional(),
    length: z.number().nullable().optional(),
    material: shortText.optional(),
    midCode: machineCode.optional(),
    /** Array position sets each option's display rank on the product. */
    options: z.array(AdminSetProductOptionEntry).max(MAX_ITEMS.small).optional(),
    originCountry: machineCode.optional(),
    status: ProductStatus.optional(),
    subtitle: shortText.optional(),
    /** The product's Tags. An unknown id answers `NOT_FOUND`. */
    tagIds: z.array(entityId).max(MAX_ITEMS.batch).optional(),
    thumbnail: httpUrl.nullable().optional(),
    title: shortText.min(1),
    /** The product's Product Type. An unknown id answers `NOT_FOUND`. */
    typeId: entityId.nullable().optional(),
    /**
     * The variants to create alongside the product. Each must name a combination the `options`
     * above can produce; omit for a product that is not sold in variations yet.
     */
    variants: z.array(AdminCreateProductVariant).max(MAX_ITEMS.bulk).optional(),
    weight: z.number().nullable().optional(),
    width: z.number().nullable().optional(),
  })
  .openapi('AdminCreateProduct')
export type AdminCreateProductBody = z.infer<typeof AdminCreateProduct>

export const AdminUpdateProduct = z
  .object({
    /** Replaces the product's Categories. An unknown id answers `NOT_FOUND`. */
    categoryIds: z.array(entityId).max(MAX_ITEMS.batch).optional(),
    /** Replaces the product's Collections. An unknown id answers `NOT_FOUND`. */
    collectionIds: z.array(entityId).max(MAX_ITEMS.batch).optional(),
    images: z.array(AdminUpsertProductImage).max(MAX_ITEMS.batch).optional(),
    /** Replaces the product's Tags. An unknown id answers `NOT_FOUND`. */
    tagIds: z.array(entityId).max(MAX_ITEMS.batch).optional(),
    thumbnail: httpUrl.nullable().optional(),
    title: shortText.min(1).optional(),
    /** `null` clears the Product Type. An unknown id answers `NOT_FOUND`. */
    typeId: entityId.nullable().optional(),
  })
  .openapi('AdminUpdateProduct')
export type AdminUpdateProductBody = z.infer<typeof AdminUpdateProduct>

export const AdminBatchVariantImages = z
  .object({
    add: z.array(entityId).max(MAX_ITEMS.batch).optional(),
    remove: z.array(entityId).max(MAX_ITEMS.batch).optional(),
  })
  .openapi('AdminBatchVariantImages')
export type AdminBatchVariantImagesBody = z.infer<typeof AdminBatchVariantImages>

export const AdminBatchImageVariant = z
  .object({
    add: z.array(entityId).max(MAX_ITEMS.batch).optional(),
    remove: z.array(entityId).max(MAX_ITEMS.batch).optional(),
  })
  .openapi('AdminBatchImageVariant')
export type AdminBatchImageVariantBody = z.infer<typeof AdminBatchImageVariant>
