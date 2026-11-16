import type { BigNumber } from '../../bignumber.js'
import type { BaseFilterable, OperatorMap } from '../common.js'

export type PriceSetDTO = {
  id: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type PriceDTO = {
  id: string
  currencyCode: string
  amount: BigNumber
  compareAtAmount: BigNumber | null
  priceSetId: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type CalculatedPriceSetDTO = {
  id: string
  calculatedAmount: BigNumber
  /** Null unless above calculatedAmount: a compare-at at or below the price is no Markdown. */
  compareAtAmount: BigNumber | null
  currencyCode: string
}

export interface FilterablePriceProps extends BaseFilterable<FilterablePriceProps> {
  id?: string | string[]
  priceSetId?: string | string[]
  currencyCode?: string | string[]
  createdAt?: OperatorMap<Date>
}

export type PricingContext = {
  currencyCode: string
}
