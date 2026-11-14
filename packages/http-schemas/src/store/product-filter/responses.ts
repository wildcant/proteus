import { z } from 'zod'
import { bigNumberToString } from '../../common.js'

/** One value of a filter, with how many products in view would remain once it is chosen. */
export const StoreProductFilterValue = z
  .object({
    /** What a selection and the URL carry: a field's stored value (`classics`), a brand's or an option's own value. */
    value: z.string(),
    /**
     * What the shopper reads: for a field value, the name of the Category whose rule selects exactly
     * it ("Classics"), else the value capitalised ("Men"); for a brand or an option, the value.
     */
    label: z.string(),
    count: z.number(),
    /**
     * Whether no product in view can be bought in this value now. Only an option's value can be: a
     * size every product in view has sold out of is drawn disabled.
     */
    soldOut: z.boolean(),
    /**
     * The colour filter's stable key for the value's swatch, `cafe` for "Café": the value lower-cased,
     * without accents, words joined by hyphens. `null` on every other filter.
     */
    swatch: z.string().nullable(),
  })
  .openapi('StoreProductFilterValue')

/**
 * A filterable metafield, "Género", keyed by its key, or a product option, "Talla", keyed
 * `option.<title>` — with every value the products in view hold, sorted.
 */
export const StoreProductFilter = z
  .object({ key: z.string(), name: z.string(), values: z.array(StoreProductFilterValue) })
  .openapi('StoreProductFilter')

/** The cheapest and the dearest price this market quotes over the products in view, for the price slider. */
export const StoreProductPriceBounds = z
  .object({ min: bigNumberToString, max: bigNumberToString })
  .openapi('StoreProductPriceBounds')

/**
 * The storefront's filters: the metafields in the structure file's order, then the options by title.
 * A field's values come in the rank of the Categories that name them. A value no product would keep
 * at the current selection is still listed, at 0, so it can show as unavailable rather than vanish.
 */
export const StoreProductFilterListResponse = z
  .object({
    filters: z.array(StoreProductFilter),
    /**
     * Over the list's scope (category, collection, search) before any selection, so choosing a range
     * never shrinks the slider it was chosen on. `null` when nothing in view has a price.
     */
    priceBounds: StoreProductPriceBounds.nullable(),
  })
  .openapi('StoreProductFilterListResponse')
export type StoreProductFilterListResponse = z.input<typeof StoreProductFilterListResponse>
