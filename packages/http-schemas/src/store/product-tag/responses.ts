import { z } from 'zod'

/** Every distinct Tag value on the products in view, sorted. Unpaginated: a shop has tens of Tags. */
export const StoreProductTagValueListResponse = z
  .object({ values: z.array(z.string()) })
  .openapi('StoreProductTagValueListResponse')
export type StoreProductTagValueListResponse = z.input<typeof StoreProductTagValueListResponse>
