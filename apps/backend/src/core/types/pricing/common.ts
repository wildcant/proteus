import type { BigNumber } from '../../db/bignum.js'
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
  priceSetId: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type CalculatedPriceSet = {
  id: string
  calculatedAmount: BigNumber | null
  currencyCode: string | null
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
