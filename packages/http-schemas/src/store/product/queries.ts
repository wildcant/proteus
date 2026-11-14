import { i18n } from '@proteus/utils'
import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

/** One filter selection, `<key>:<value>`. The value is everything after the first colon. */
const metafieldSelection = z.string().regex(/^[^:]+:.+$/s, i18n.t('Write a filter as key:value'))

export const StoreProductListParams = createFindParams().extend({
  q: z.string().optional(),
  /** A Category's handle. Lists its products and its Visible descendants'; a hidden Category matches nothing. */
  category: z.string().min(1).optional(),
  /** A Collection's handle. Lists its members; an unknown or deleted Collection matches nothing. */
  collection: z.string().min(1).optional(),
  /** Tag values, repeatable. Lists products carrying any of them; an unknown value matches nothing. */
  tag: z.union([z.string().min(1), z.string().min(1).array()]).optional(),
  /**
   * Filter selections as `<key>:<value>`, repeatable: `filter=genero:women&filter=option.Talla:42`. A
   * key is a metafield's key or `option.<title>` for a product option. Lists products holding any of
   * the values chosen for a key, for every key chosen; an unknown key matches nothing.
   */
  filter: z.union([metafieldSelection, metafieldSelection.array()]).optional(),
  /** The lowest price, in the market's currency: lists products with a variant priced at least this. */
  minPrice: z.coerce.number().min(0).optional(),
  /** The highest price, in the market's currency: lists products with a variant priced at most this. */
  maxPrice: z.coerce.number().min(0).optional(),
})

export type StoreProductListQuery = FindParams<typeof StoreProductListParams>

/** A product's handle, the storefront's address for it: `/products/<handle>`. */
export const StoreProductHandleParams = z.object({ handle: z.string().min(1) })
export type StoreProductHandleParams = z.infer<typeof StoreProductHandleParams>
