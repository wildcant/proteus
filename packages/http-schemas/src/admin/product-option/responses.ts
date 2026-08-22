import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminProductOption, AdminProductOptionValue, AdminProductScopedOption } from './entities.js'

export const AdminProductOptionResponse = z
  .object({ productOption: AdminProductOption })
  .openapi('AdminProductOptionResponse')
export type AdminProductOptionResponse = z.input<typeof AdminProductOptionResponse>

export const AdminProductOptionListResponse = PaginatedResponse.extend({
  productOptions: z.array(AdminProductOption),
}).openapi('AdminProductOptionListResponse')
export type AdminProductOptionListResponse = z.input<typeof AdminProductOptionListResponse>

export const AdminSetProductOptionsResponse = z
  .object({ productOptions: z.array(AdminProductScopedOption) })
  .openapi('AdminSetProductOptionsResponse')
export type AdminSetProductOptionsResponse = z.input<typeof AdminSetProductOptionsResponse>

export const AdminProductOptionValueListResponse = PaginatedResponse.extend({
  values: z.array(AdminProductOptionValue),
}).openapi('AdminProductOptionValueListResponse')
export type AdminProductOptionValueListResponse = z.input<typeof AdminProductOptionValueListResponse>
