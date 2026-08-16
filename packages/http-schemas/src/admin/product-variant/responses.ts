import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminProductVariant } from './entities.js'

export const AdminProductVariantResponse = z
  .object({ variant: AdminProductVariant })
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
