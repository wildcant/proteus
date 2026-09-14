import type { CreateStockLocationDTO } from '@core/types/stock-location/mutations.js'
import { faker } from '@faker-js/faker'

export function generateCreateStockLocationDTO(overrides?: Partial<CreateStockLocationDTO>): CreateStockLocationDTO {
  return {
    name: `${faker.location.city()} Warehouse`,
    ...overrides,
  }
}
