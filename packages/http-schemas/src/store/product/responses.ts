import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import {
  StoreProduct,
  StoreProductImage,
  StoreProductListItem,
  StoreProductOption,
  StoreProductVariant,
} from './entities.js'

export const StoreProductResponse = z
  .object({
    product: StoreProduct.extend({
      images: z.array(StoreProductImage),
      /** The options this product offers, in the order the picker should render them. */
      options: z.array(StoreProductOption),
      variants: z.array(StoreProductVariant),
    }),
  })
  .openapi('StoreProductResponse')
export type StoreProductResponse = z.input<typeof StoreProductResponse>

export const StoreProductListResponse = PaginatedResponse.extend({
  products: z.array(StoreProductListItem),
}).openapi('StoreProductListResponse')
export type StoreProductListResponse = z.input<typeof StoreProductListResponse>
