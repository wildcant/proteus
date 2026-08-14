import type { BigNumber } from '../../db/bignum.js'

export type CreatePriceDTO = {
  currencyCode: string
  amount: BigNumber
}

export type CreatePriceSetDTO = {
  prices?: CreatePriceDTO[]
}

export type UpdatePriceDTO = {
  amount?: BigNumber
  currencyCode?: string
}
