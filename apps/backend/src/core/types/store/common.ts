import type { BaseFilterable, OperatorMap } from '../common.js'

export type StoreDTO = {
  id: string
  name: string
  /** The region a shopper is served from before they pick one. */
  defaultRegionId: string | null
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
