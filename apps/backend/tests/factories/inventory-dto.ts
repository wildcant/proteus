import type { InventoryLevelDTO } from '@core/types/inventory/common.js'
import { faker } from '@faker-js/faker'

export function generateInventoryLevelDTO(overrides?: Partial<InventoryLevelDTO>): InventoryLevelDTO {
  return {
    id: `ilev_${faker.string.alphanumeric(32)}`,
    inventoryItemId: `iitem_${faker.string.alphanumeric(32)}`,
    locationId: `sloc_${faker.string.alphanumeric(32)}`,
    stockedQuantity: faker.number.int({ min: 0, max: 1000 }),
    reservedQuantity: 0,
    incomingQuantity: 0,
    metadata: null,
    createdAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}
