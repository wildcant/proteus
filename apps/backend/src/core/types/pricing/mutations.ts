import type { BigNumber } from '../../bignumber.js'

export type CreatePriceDTO = {
  currencyCode: string
  amount: BigNumber
  compareAtAmount?: BigNumber | null
}

export type CreatePriceSetDTO = {
  prices?: CreatePriceDTO[]
}

export type UpdatePriceDTO = {
  amount?: BigNumber
  compareAtAmount?: BigNumber | null
  currencyCode?: string
}

export type UpdatePriceSetDTO = {
  id: string
  prices?: (CreatePriceDTO & { id?: string })[]
}

export type UpsertPriceSetDTO = CreatePriceSetDTO | UpdatePriceSetDTO
