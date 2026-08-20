import type { FulfillmentDTO } from '@core/types/fulfillment/common.js'
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
