import type { BaseFilterable, OperatorMap } from '../common.js'

type StoreNavigationTargetType = 'category' | 'collection'

/**
 * A link a menu section names by hand: the entry's own list filtered by field values (`filter`, keyed
 * by clave, values ORed within a clave), or a Category or Collection by handle, labelled by `name` or,
 * when that is null, by the grouping's own.
 */
export type StoreNavigationLinkDTO =
  | { type: 'filter'; name: string; filter: Record<string, string[]> }
  | { type: StoreNavigationTargetType; handle: string; name: string | null }

/**
 * One column of a menu entry's panel, as the structure file writes it: the entry's visible child
 * Categories, each distinct value of one field among the entry's products (cut at `limit`), or fixed links.
 */
export type StoreNavigationSectionDTO =
  | { type: 'subcategories'; name: string }
  | { type: 'values'; name: string; key: string; limit: number | null }
  | { type: 'links'; name: string; links: StoreNavigationLinkDTO[] }

/**
 * One entry of the store's menu: a Category or a Collection, by handle. With no `sections` a
 * Category brings its children; with them, the entry opens a panel of those sections.
 */
export type StoreNavigationEntryDTO = {
  type: StoreNavigationTargetType
  handle: string
  sections: StoreNavigationSectionDTO[]
}

export type StoreDTO = {
  id: string
  name: string
  /** The region a shopper is served from before they pick one. */
  defaultRegionId: string | null
  /**
   * At or below how many units available a variant counts as running low, or `null` for a shop
   * that does not want the idea at all. One number for both audiences — the shopkeeper's alert and
   * the shopper's "only N left" line — so the two cannot disagree about what low means.
   */
  lowStockThreshold: number | null
  /** The store's menu, in order. Written by applying a structure file; a handle may name nothing live. */
  navigation: StoreNavigationEntryDTO[]
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableStoreProps extends BaseFilterable<FilterableStoreProps> {
  id?: string | string[]
  name?: string | OperatorMap<string>
  defaultRegionId?: string | string[]
}

export type StoreCurrencyDTO = {
  id: string
  storeId: string
  currencyCode: string
  isDefault: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableStoreCurrencyProps extends BaseFilterable<FilterableStoreCurrencyProps> {
  id?: string | string[]
  storeId?: string | string[]
  currencyCode?: string | string[]
  isDefault?: boolean
}
