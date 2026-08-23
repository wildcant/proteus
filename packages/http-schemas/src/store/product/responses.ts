import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import {
  StoreProduct,
  StoreProductImage,
  StoreProductListItem,
  StoreProductScopedOption,
  StoreProductVariant,
} from './entities.js'

export const StoreProductResponse = z
  .object({
    product: StoreProduct.extend({
      images: z.array(StoreProductImage),
      /** The options this product offers, in the order the picker should render them. */
      options: z.array(StoreProductScopedOption),
      variants: z.array(StoreProductVariant),
      /**
       * The picker, precomputed: for each variant a shopper could be looking at, where every option
       * value would take them. `null` means that value is not reachable from there, and a value is
       * selected when its target is the variant itself.
       */
      pickerTargets: z.record(z.string(), z.record(z.string(), z.string().nullable())),
    }),
  })
  .openapi('StoreProductResponse')
export type StoreProductResponse = z.input<typeof StoreProductResponse>

export const StoreProductListResponse = PaginatedResponse.extend({
  products: z.array(StoreProductListItem),
}).openapi('StoreProductListResponse')
export type StoreProductListResponse = z.input<typeof StoreProductListResponse>
