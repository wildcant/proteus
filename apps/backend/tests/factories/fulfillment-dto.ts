import type { FulfillmentDTO } from '@core/types/fulfillment/common.js'
import type {
  CreateFulfillmentSetDTO,
  CreateGeoZoneDTO,
  CreateServiceZoneDTO,
  UpdateFulfillmentDTO,
} from '@core/types/fulfillment/mutations.js'
import { faker } from '@faker-js/faker'

export function generateCreateFulfillmentSetDTO(overrides?: Partial<CreateFulfillmentSetDTO>): CreateFulfillmentSetDTO {
  return {
    name: `${faker.location.country()} delivery`,
    type: faker.helpers.arrayElement(['shipping', 'pickup']),
    ...overrides,
  }
}

/** `fulfillmentSetId` is a real foreign key, so every caller passes one it created. */
export function generateCreateServiceZoneDTO(
  fulfillmentSetId: string,
  overrides?: Partial<CreateServiceZoneDTO>,
): CreateServiceZoneDTO {
  return {
    name: `${faker.location.state()} zone`,
    fulfillmentSetId,
    ...overrides,
  }
}

export function generateCreateGeoZoneDTO(overrides?: Partial<CreateGeoZoneDTO>): CreateGeoZoneDTO {
  return {
    type: 'country',
    countryCode: faker.location.countryCode().toLowerCase(),
    ...overrides,
  }
}

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
