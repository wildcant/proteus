import type { ProductListScope } from '#/features/products/api/products'
import type { ProductListLinks } from '#/features/products/types/links'
import type { ProductListSearch } from '#/features/products/utils/product-list-search'

/**
 * What a page hands both `ProductListHeader` and `ProductList`, so the header's count and the grid
 * read one request. The route validates `search` and hands it in, because a list reading the search
 * non-strictly would see every route's search params, not this page's; a change goes through the
 * route's links, which stay on whichever route that is.
 */
export type ProductListView = {
  scope: ProductListScope
  search: ProductListSearch
  links: ProductListLinks
}
