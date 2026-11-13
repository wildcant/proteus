import type { ProductListSearch } from '#/features/products/utils/product-list-search'
import type { LinkTarget } from '#/lib/link-target'

/** A product card's link, its PRODUCT event on the screen the card is on. */
export type ProductLinkTo = (productId: string) => LinkTarget

/** The search panel's ways out, the `Root` screen's search states on the flow map. */
export type SearchLinks = {
  open: LinkTarget
  close: LinkTarget
  product: ProductLinkTo
  /** SEARCH_SUBMIT: the list for a term, or every product for an empty one. */
  submit: (term: string) => LinkTarget
  /** VIEW_ALL_RESULTS. */
  viewAll: (term: string) => LinkTarget
  /** VIEW_BEST_SELLERS. */
  bestSellers: LinkTarget
}

/**
 * An event that stays on the list's own route, whichever that is (`./state` on the flow map): the search params it
 * changes, merged over the current ones.
 */
export type SearchLink = (update: Partial<ProductListSearch>) => LinkTarget

/** A product list page's ways out, the `ProductListPage` screen's. */
export type ProductListLinks = {
  product: ProductLinkTo
  /** SHOP_ALL, from a scoped list with nothing in it. */
  shopAll: LinkTarget
  filter: SearchLink
  tag: SearchLink
  sort: SearchLink
  page: SearchLink
  clearFilters: SearchLink
  clearSearch: SearchLink
}

/** A product page's ways out, the `ProductDetail` screen's. */
export type ProductDetailLinks = {
  /** BACK_TO_PRODUCTS. */
  products: LinkTarget
  /** BROWSE, from a product this market can't show. */
  browse: LinkTarget
  /** CHOOSE_VARIANT. */
  variant: (variantId: string) => LinkTarget
  /** ADD_TO_BAG: the bag, open over this page. */
  bagOpen: LinkTarget
}
