import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminProductImage } from '../product/entities.js'
import { AdminProductVariant } from './entities.js'

// Only the detail endpoint resolves the images assigned to the variant through the pivot.
const AdminProductVariantDetail = AdminProductVariant.extend({
  images: z.array(AdminProductImage).optional(),
})

export const AdminProductVariantResponse = z
  .object({ variant: AdminProductVariantDetail })
  .openapi('AdminProductVariantResponse')
export type AdminProductVariantResponse = z.input<typeof AdminProductVariantResponse>

export const AdminCreateProductVariantResponse = z
  .object({ variant: AdminProductVariant })
  .openapi('AdminCreateProductVariantResponse')
export type AdminCreateProductVariantResponse = z.input<typeof AdminCreateProductVariantResponse>

export const AdminUpdateProductVariantResponse = z
  .object({ variant: AdminProductVariant })
  .openapi('AdminUpdateProductVariantResponse')
export type AdminUpdateProductVariantResponse = z.input<typeof AdminUpdateProductVariantResponse>

export const AdminUpdateVariantPricesResponse = z
  .object({ variant: AdminProductVariant })
  .openapi('AdminUpdateVariantPricesResponse')
export type AdminUpdateVariantPricesResponse = z.input<typeof AdminUpdateVariantPricesResponse>

export const AdminProductVariantListResponse = PaginatedResponse.extend({
  variants: z.array(AdminProductVariant),
}).openapi('AdminProductVariantListResponse')
export type AdminProductVariantListResponse = z.input<typeof AdminProductVariantListResponse>

export const AdminCreateProductVariantsBatchResponse = z
  .object({ variants: z.array(AdminProductVariant) })
  .openapi('AdminCreateProductVariantsBatchResponse')
export type AdminCreateProductVariantsBatchResponse = z.input<typeof AdminCreateProductVariantsBatchResponse>
