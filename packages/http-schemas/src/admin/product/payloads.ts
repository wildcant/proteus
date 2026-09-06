import { z } from 'zod'
import { entityId, httpUrl, longText, MAX_ITEMS, machineCode, shortText } from '../../bounded.js'
import { AdminSetProductOptionEntry } from '../product-option/payloads.js'
import { AdminCreateProductVariant } from '../product-variant/payloads.js'
import { ProductStatus } from './entities.js'

const AdminCreateProductImage = z.object({ url: httpUrl.min(1) })

export const AdminUpsertProductImage = z.object({ id: entityId.optional(), url: httpUrl.min(1) })

export const AdminCreateProduct = z
  .object({
    description: longText.optional(),
    discountable: z.boolean().optional(),
    handle: machineCode.optional(),
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
    thumbnail: httpUrl.nullable().optional(),
    title: shortText.min(1),
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
    images: z.array(AdminUpsertProductImage).max(MAX_ITEMS.batch).optional(),
    thumbnail: httpUrl.nullable().optional(),
    title: shortText.min(1).optional(),
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
