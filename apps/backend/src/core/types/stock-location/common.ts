import type { BaseFilterable, OperatorMap } from '../common.js'

export type StockLocationDTO = {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export interface FilterableStockLocationProps extends BaseFilterable<FilterableStockLocationProps> {
  id?: string | string[]
  name?: string | OperatorMap<string>
}
