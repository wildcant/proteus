import { z } from 'zod'
import { AdminSetProductOptionEntry } from '../product-option/payloads.js'
import { AdminCreateProductVariant } from '../product-variant/payloads.js'
import { ProductStatus } from './entities.js'

const AdminCreateProductImage = z.object({ url: z.string().min(1) })

export const AdminUpsertProductImage = z.object({ id: z.string().optional(), url: z.string().min(1) })

export const AdminCreateProduct = z
  .object({
    description: z.string().optional(),
    discountable: z.boolean().optional(),
    handle: z.string().optional(),
    height: z.number().nullable().optional(),
    hsCode: z.string().optional(),
    images: z.array(AdminCreateProductImage).optional(),
    length: z.number().nullable().optional(),
    material: z.string().optional(),
    midCode: z.string().optional(),
    /** Array position sets each option's display rank on the product. */
    options: z.array(AdminSetProductOptionEntry).optional(),
    originCountry: z.string().optional(),
    status: ProductStatus.optional(),
    subtitle: z.string().optional(),
    thumbnail: z.string().nullable().optional(),
    title: z.string().min(1),
    /**
     * The variants to create alongside the product. Each must name a combination the `options`
     * above can produce; omit for a product that is not sold in variations yet.
     */
    variants: z.array(AdminCreateProductVariant).optional(),
    weight: z.number().nullable().optional(),
    width: z.number().nullable().optional(),
  })
  .openapi('AdminCreateProduct')
export type AdminCreateProductBody = z.infer<typeof AdminCreateProduct>

export const AdminUpdateProduct = z
  .object({
    images: z.array(AdminUpsertProductImage).optional(),
    thumbnail: z.string().nullable().optional(),
    title: z.string().min(1).optional(),
  })
  .openapi('AdminUpdateProduct')
export type AdminUpdateProductBody = z.infer<typeof AdminUpdateProduct>

export const AdminBatchVariantImages = z
  .object({
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional(),
  })
  .openapi('AdminBatchVariantImages')
export type AdminBatchVariantImagesBody = z.infer<typeof AdminBatchVariantImages>

export const AdminBatchImageVariant = z
  .object({
    add: z.array(z.string()).optional(),
    remove: z.array(z.string()).optional(),
  })
  .openapi('AdminBatchImageVariant')
export type AdminBatchImageVariantBody = z.infer<typeof AdminBatchImageVariant>
