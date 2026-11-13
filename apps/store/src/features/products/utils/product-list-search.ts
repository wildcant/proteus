import { z } from 'zod'
import { PRODUCT_SORT_NAMES } from '#/features/products/api/products'

/** A repeated key read as a list: one `?tag=cotton` is one value. */
const repeatedKey = <T extends z.ZodType>(item: T) =>
  z
    .preprocess(
      (value) => (value === undefined || Array.isArray(value) ? value : [value]),
      z.array(item).min(1).optional(),
    )
    .catch(undefined)

/**
 * Everything that describes what the shopper is looking at inside a product list: the term, the
 * chosen Tags, filter values and price range, the order and the page. All are optional and none is written when it holds its
 * default, so `/` and `/?q=tee` stay exactly those strings.
 *
 * Every route that renders `ProductList` validates its search with this, so `q`, `tag`, `filter`, `minPrice`, `maxPrice`,
 * `sort` and `offset` mean the same thing on the home page, a category and a collection.
 */
export const productListSearchSchema = z.object({
  // `.catch` so a stray `?q=` degrades to the unfiltered list instead of erroring the route.
  q: z.string().trim().min(1).optional().catch(undefined),
  // Tag values, any of which a product may carry, as a repeated key: `?tag=cotton&tag=wool`. One
  // `?tag=cotton` reads as one value. Coerced, because the router's parser turns a value that looks
  // like a number into one, and `?tag=2024` is still the Tag "2024".
  tag: repeatedKey(z.coerce.string().min(1)),
  // Metafield and option values as `<key>:<value>`, the API's own spelling, repeated like `tag`:
  // `?filter=genero:women&filter=option.Talla:42`. A shopper's values for one key widen the list, keys narrow it.
  filter: repeatedKey(z.string().regex(/^[^:]+:.+$/s)),
  // The price range in the market's currency, either end open: `?minPrice=100000&maxPrice=300000`.
  minPrice: z.coerce.number().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().min(0).optional().catch(undefined),
  // A friendly enum rather than the API's `order` string: an unrecognised column is not a 400,
  // it is silently an unordered list, and an enum makes that unrepresentable.
  sort: z.enum(PRODUCT_SORT_NAMES).optional().catch(undefined),
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
})

export type ProductListSearch = z.infer<typeof productListSearchSchema>
