import type { BaseFilterable, OperatorMap } from '../common.js'

type StoreNavigationTargetType = 'category' | 'collection'

/**
 * A link a menu section names by hand: the entry's own list filtered by field values (`filter`, keyed
 * by field key, values ORed within a key), or a Category or Collection by handle, labelled by `name` or,
 * when that is null, by the grouping's own.
 */
export type StoreNavigationLinkDTO =
  | { type: 'filter'; name: string; filter: Record<string, string[]> }
  | { type: StoreNavigationTargetType; handle: string; name: string | null }

/** What every section may carry: a short text the store shows under its links, e.g. "Te mostramos solo lo que hay en tu talla." */
type StoreNavigationSectionNote = { note?: string }

/**
 * One column of a menu entry's panel, as the structure file writes it: the entry's visible child
 * Categories; each distinct value of one field among the entry's products (cut at `limit`); those
 * values grouped by a second field (`groupKey`), the groups with the most products first, at most
 * `groups` of them and `limit` values in each; the values of a product option (`option`, by title)
 * the entry's products offer; or fixed links.
 */
export type StoreNavigationSectionDTO = StoreNavigationSectionNote &
  (
    | { type: 'subcategories'; name: string }
    | { type: 'values'; name: string; key: string; limit: number | null }
    | { type: 'groups'; name: string; key: string; groupKey: string; groups: number | null; limit: number | null }
    | { type: 'option'; name: string; option: string }
    | { type: 'links'; name: string; links: StoreNavigationLinkDTO[] }
  )

/**
 * One entry of the store's menu: a Category or a Collection, by handle. With no `sections` a
 * Category brings its children; with them, the entry opens a panel of those sections. `footer` holds
 * the links set apart below the panel's columns; an entry without one has none.
 */
export type StoreNavigationEntryDTO = {
  type: StoreNavigationTargetType
  handle: string
  sections: StoreNavigationSectionDTO[]
  footer?: StoreNavigationLinkDTO[]
}

/**
 * A most-searched model, as the structure file's `search.trending` names it: its label, the list it
 * leads to filtered by field values (keyed by field key, values ORed within a key), and `note`, a
 * short line under it, `null` for none.
 */
type StoreSearchTrendingDTO = { name: string; filter: Record<string, string[]>; note: string | null }

/**
 * What search offers before the shopper finds anything, as the structure file's `search` has it:
 * `popular`, the terms a search chip runs, and `trending`, the most-searched models. Both empty when
 * the file has no `search`.
 */
export type StoreSearchDTO = { popular: string[]; trending: StoreSearchTrendingDTO[] }

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
  /** The structure file's `search`. */
  search: StoreSearchDTO
  /** The structure file's `filters`, the filter keys in display order; `null` when it has none. */
  filters: string[] | null
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
