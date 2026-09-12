import { BigNumber } from '@core/bignumber.js'
import type { CalculatedPriceSetDTO } from '@core/types/pricing/common.js'
import type { CreatePriceDTO, CreatePriceSetDTO } from '@core/types/pricing/mutations.js'
import { faker } from '@faker-js/faker'

export function generateCreatePriceSetDTO(overrides?: Partial<CreatePriceSetDTO>): CreatePriceSetDTO {
  return {
    prices: [generateCreatePriceDTO()],
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

export function generateCalculatedPriceSetDTO(overrides?: Partial<CalculatedPriceSetDTO>): CalculatedPriceSetDTO {
  return {
    id: `pset_${faker.string.alphanumeric(32)}`,
    calculatedAmount: new BigNumber(faker.commerce.price({ min: 1, max: 1000 })),
    currencyCode: 'usd',
    ...overrides,
  }
}
