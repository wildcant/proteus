import type { InventoryLevelDTO, ReservationItemDTO } from '@core/types/inventory/common.js'
import type { CreateInventoryItemDTO, CreateInventoryLevelDTO } from '@core/types/inventory/mutations.js'
import { faker } from '@faker-js/faker'

export function generateReservationItemDTO(overrides?: Partial<ReservationItemDTO>): ReservationItemDTO {
  return {
    id: `resitem_${faker.string.alphanumeric(32)}`,
    inventoryItemId: `iitem_${faker.string.alphanumeric(32)}`,
    locationId: `sloc_${faker.string.alphanumeric(32)}`,
    quantity: faker.number.int({ min: 1, max: 100 }),
    lineItemId: null,
    allowBackorder: false,
    externalId: null,
    description: null,
    createdBy: null,
    metadata: null,
    createdAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

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

export function generateCreateInventoryItemDTO(overrides?: Partial<CreateInventoryItemDTO>): CreateInventoryItemDTO {
  return {
    sku: faker.string.alphanumeric(10).toUpperCase(),
    ...overrides,
  }
}

export function generateCreateInventoryLevelDTO(overrides?: Partial<CreateInventoryLevelDTO>): CreateInventoryLevelDTO {
  return {
    inventoryItemId: `iitem_${faker.string.alphanumeric(32)}`,
    locationId: `sloc_${faker.string.alphanumeric(32)}`,
    stockedQuantity: faker.number.int({ min: 0, max: 1000 }),
    ...overrides,
  }
}
