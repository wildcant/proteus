import type { BaseFilterable, OperatorMap } from '../common.js'

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
