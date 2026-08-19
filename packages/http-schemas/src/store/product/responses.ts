import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { StoreProduct, StoreProductListItem, StoreProductVariant } from './entities.js'

export const StoreProductResponse = z
  .object({ product: StoreProduct.extend({ variants: z.array(StoreProductVariant) }) })
  .openapi('StoreProductResponse')
export type StoreProductResponse = z.input<typeof StoreProductResponse>

export const StoreProductListResponse = PaginatedResponse.extend({
  products: z.array(StoreProductListItem),
}).openapi('StoreProductListResponse')
export type StoreProductListResponse = z.input<typeof StoreProductListResponse>
