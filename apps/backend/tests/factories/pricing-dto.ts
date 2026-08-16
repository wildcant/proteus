import { BigNumber } from '@core/db/bignum.js'
import type { CreatePriceDTO, CreatePriceSetDTO } from '@core/types/index.js'
import { faker } from '@faker-js/faker'

export function generateCreatePriceSetDTO(overrides?: Partial<CreatePriceSetDTO>): CreatePriceSetDTO {
  return {
    prices: [
      {
        currencyCode: 'usd',
        amount: new BigNumber(faker.commerce.price({ min: 1, max: 1000 })),
      },
    ],
    ...overrides,
  }
}

export function generateCreatePriceDTO(overrides?: Partial<CreatePriceDTO>): CreatePriceDTO {
  return {
    currencyCode: 'usd',
    amount: new BigNumber(faker.commerce.price({ min: 1, max: 1000 })),
    ...overrides,
  }
}
