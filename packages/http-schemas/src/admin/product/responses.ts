import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminProductOption } from '../product-option/entities.js'
import { AdminProductVariant } from '../product-variant/entities.js'
import { AdminProduct, AdminProductImage } from './entities.js'

const AdminProductDetail = AdminProduct.extend({
  options: z.array(AdminProductOption).optional(),
  images: z.array(AdminProductImage).optional(),
})

export const AdminProductResponse = z.object({ product: AdminProductDetail }).openapi('AdminProductResponse')
export type AdminProductResponse = z.input<typeof AdminProductResponse>

export const AdminCreateProductResponse = z.object({ product: AdminProduct }).openapi('AdminCreateProductResponse')
export type AdminCreateProductResponse = z.input<typeof AdminCreateProductResponse>

export const AdminUpdateProductResponse = z.object({ product: AdminProduct }).openapi('AdminUpdateProductResponse')
export type AdminUpdateProductResponse = z.input<typeof AdminUpdateProductResponse>

export const AdminProductListResponse = PaginatedResponse.extend({
  products: z.array(AdminProduct),
}).openapi('AdminProductListResponse')
export type AdminProductListResponse = z.input<typeof AdminProductListResponse>

export const AdminBatchImageVariantResponse = z
  .object({ added: z.array(z.string()), removed: z.array(z.string()) })
  .openapi('AdminBatchImageVariantResponse')
export type AdminBatchImageVariantResponse = z.input<typeof AdminBatchImageVariantResponse>

export const AdminBatchVariantImagesResponse = z
  .object({ added: z.array(z.string()), removed: z.array(z.string()) })
  .openapi('AdminBatchVariantImagesResponse')
export type AdminBatchVariantImagesResponse = z.input<typeof AdminBatchVariantImagesResponse>

// The complete set, unpaginated — callers need every linked variant to diff a batch update.
export const AdminImageVariantsResponse = z
  .object({ variants: z.array(AdminProductVariant) })
  .openapi('AdminImageVariantsResponse')
export type AdminImageVariantsResponse = z.input<typeof AdminImageVariantsResponse>
