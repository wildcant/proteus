import { z } from 'zod'

/** One value of a filter, with how many products in view would remain once it is chosen. */
export const StoreProductFilterValue = z
  .object({ value: z.string(), count: z.number() })
  .openapi('StoreProductFilterValue')

/**
 * A filterable metafield, "Género", keyed by its key, or a product option, "Talla", keyed
 * `option.<title>` — with every value the products in view hold, sorted.
 */
export const StoreProductFilter = z
  .object({ key: z.string(), name: z.string(), values: z.array(StoreProductFilterValue) })
  .openapi('StoreProductFilter')

/**
 * The storefront's filters: the metafields in the structure file's order, then the options by title. A value no product would keep at the
 * current selection is still listed, at 0, so it can show as unavailable rather than vanish.
 */
export const StoreProductFilterListResponse = z
  .object({ filters: z.array(StoreProductFilter) })
  .openapi('StoreProductFilterListResponse')
export type StoreProductFilterListResponse = z.input<typeof StoreProductFilterListResponse>
