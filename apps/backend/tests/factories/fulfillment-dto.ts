import type { FulfillmentDTO } from '@core/types/fulfillment/common.js'
import type { UpdateFulfillmentDTO } from '@core/types/fulfillment/mutations.js'
import { faker } from '@faker-js/faker'

export function generateFulfillmentDTO(overrides?: Partial<FulfillmentDTO>): FulfillmentDTO {
  return {
    id: `ful_${faker.string.alphanumeric(32)}`,
    locationId: `sloc_${faker.string.alphanumeric(32)}`,
    providerId: 'manual',
    shippingOptionId: null,
    data: null,
    requiresShipping: true,
    packedAt: null,
    shippedAt: null,
    deliveredAt: null,
    canceledAt: null,
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export function generateUpdateFulfillmentDTO(overrides?: Partial<UpdateFulfillmentDTO>): UpdateFulfillmentDTO {
  return {
    data: { trackingNumber: faker.string.alphanumeric(12).toUpperCase() },
    packedAt: faker.date.recent(),
    shippedAt: faker.date.recent(),
    deliveredAt: faker.date.recent(),
    canceledAt: faker.date.recent(),
    metadata: faker.lorem.word(),
    ...overrides,
  }
}
