import { z } from 'zod'
import { PRODUCT_SORT_NAMES, type ProductListScope } from '#/features/products/api/products'

/**
 * Everything that describes what the shopper is looking at inside a product list: the term, the
 * order and the page. All three are optional and none is written when it holds its default, so `/`
 * and `/?q=tee` stay exactly those strings.
 *
 * Every route that renders `ProductList` validates its search with this, so `q`, `sort` and
 * `offset` mean the same thing on the home page, a category and a collection.
 */
export const productListSearchSchema = z.object({
  // `.catch` so a stray `?q=` degrades to the unfiltered list instead of erroring the route.
  q: z.string().trim().min(1).optional().catch(undefined),
  // A friendly enum rather than the API's `order` string: an unrecognised column is not a 400,
  // it is silently an unordered list, and an enum makes that unrepresentable.
  sort: z.enum(PRODUCT_SORT_NAMES).optional().catch(undefined),
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
})

export type ProductListSearch = z.infer<typeof productListSearchSchema>

/**
 * What a page hands both `ProductListHeader` and `ProductList`, so the header's count and the grid
 * read one request. The page owns its URL — it validates `search` and navigates on
 * `onSearchChange` through its own route — because a list reading the search non-strictly would
 * see every route's search params, not this page's.
 */
export type ProductListView = {
  scope: ProductListScope
  search: ProductListSearch
  onSearchChange: (update: Partial<ProductListSearch>) => void
}
