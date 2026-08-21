import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import type {
  CreateFulfillmentProvider,
  CreateFulfillmentSet,
  CreateGeoZone,
  CreateServiceZone,
  CreateShippingOption,
  CreateShippingOptionType,
  CreateShippingProfile,
} from '../../../src/schema.js'
import {
  fulfillmentProviderTable,
  fulfillmentSetTable,
  geoZoneTable,
  serviceZoneTable,
  shippingOptionTable,
  shippingOptionTypeTable,
  shippingProfileTable,
} from '../../../src/schema.js'
import { db } from '../../db/client.js'

// --- FulfillmentProvider ---

export function generateFulfillmentProvider(overrides?: Partial<CreateFulfillmentProvider>): CreateFulfillmentProvider {
  return {
    id: `fp_${faker.string.alphanumeric(20)}`,
    isEnabled: faker.datatype.boolean(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createFulfillmentProvider(overrides?: Partial<CreateFulfillmentProvider>) {
  const values = generateFulfillmentProvider(overrides)
  const result = await db.insert(fulfillmentProviderTable).values(values).returning()
  const fulfillmentProvider = result[0]
  if (!fulfillmentProvider) throw new Error('FulfillmentProvider insert returned no rows')

  return {
    ...fulfillmentProvider,
    [Symbol.asyncDispose]: async () => {
      await deleteFulfillmentProviderById(fulfillmentProvider.id)
    },
  }
}

export async function deleteFulfillmentProviderById(id: string) {
  await db.delete(fulfillmentProviderTable).where(eq(fulfillmentProviderTable.id, id))
}

// --- ShippingProfile ---

export function generateShippingProfile(overrides?: Partial<CreateShippingProfile>): CreateShippingProfile {
  return {
    name: faker.commerce.department(),
    type: faker.helpers.arrayElement(['default', 'gift_card', 'custom']),
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createShippingProfile(overrides?: Partial<CreateShippingProfile>) {
  const values = generateShippingProfile(overrides)
  const result = await db.insert(shippingProfileTable).values(values).returning()
  const shippingProfile = result[0]
  if (!shippingProfile) throw new Error('ShippingProfile insert returned no rows')

  return {
    ...shippingProfile,
    [Symbol.asyncDispose]: async () => {
      await deleteShippingProfileById(shippingProfile.id)
    },
  }
}

export async function deleteShippingProfileById(id: string) {
  await db.delete(shippingProfileTable).where(eq(shippingProfileTable.id, id))
}

// --- FulfillmentSet ---

export function generateFulfillmentSet(overrides?: Partial<CreateFulfillmentSet>): CreateFulfillmentSet {
  return {
    name: faker.commerce.department(),
    type: faker.helpers.arrayElement(['shipping', 'pickup']),
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createFulfillmentSet(overrides?: Partial<CreateFulfillmentSet>) {
  const values = generateFulfillmentSet(overrides)
  const result = await db.insert(fulfillmentSetTable).values(values).returning()
  const fulfillmentSet = result[0]
  if (!fulfillmentSet) throw new Error('FulfillmentSet insert returned no rows')

  return {
    ...fulfillmentSet,
    [Symbol.asyncDispose]: async () => {
      await deleteFulfillmentSetById(fulfillmentSet.id)
    },
  }
}

export async function deleteFulfillmentSetById(id: string) {
  await db.delete(fulfillmentSetTable).where(eq(fulfillmentSetTable.id, id))
}

// --- ServiceZone ---

export function generateServiceZone(overrides?: Partial<CreateServiceZone>): CreateServiceZone {
  return {
    name: faker.location.country(),
    fulfillmentSetId: `fuset_${faker.string.alphanumeric(32)}`,
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createServiceZone(overrides?: Partial<CreateServiceZone>) {
  const values = generateServiceZone(overrides)
  const result = await db.insert(serviceZoneTable).values(values).returning()
  const serviceZone = result[0]
  if (!serviceZone) throw new Error('ServiceZone insert returned no rows')

  return {
    ...serviceZone,
    [Symbol.asyncDispose]: async () => {
      await deleteServiceZoneById(serviceZone.id)
    },
  }
}

export async function deleteServiceZoneById(id: string) {
  await db.delete(serviceZoneTable).where(eq(serviceZoneTable.id, id))
}

// --- GeoZone ---

export function generateGeoZone(overrides?: Partial<CreateGeoZone>): CreateGeoZone {
  return {
    type: faker.helpers.arrayElement(['country', 'province', 'city', 'zip']),
    countryCode: faker.location.countryCode().toLowerCase(),
    provinceCode: null,
    city: null,
    postalExpression: null,
    serviceZoneId: `serzo_${faker.string.alphanumeric(32)}`,
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createGeoZone(overrides?: Partial<CreateGeoZone>) {
  const values = generateGeoZone(overrides)
  const result = await db.insert(geoZoneTable).values(values).returning()
  const geoZone = result[0]
  if (!geoZone) throw new Error('GeoZone insert returned no rows')

  return {
    ...geoZone,
    [Symbol.asyncDispose]: async () => {
      await deleteGeoZoneById(geoZone.id)
    },
  }
}

export async function deleteGeoZoneById(id: string) {
  await db.delete(geoZoneTable).where(eq(geoZoneTable.id, id))
}

// --- ShippingOptionType ---

export function generateShippingOptionType(overrides?: Partial<CreateShippingOptionType>): CreateShippingOptionType {
  return {
    label: faker.helpers.arrayElement(['Standard', 'Express', 'Overnight']),
    description: faker.commerce.productDescription(),
    code: faker.string.alphanumeric(10),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createShippingOptionType(overrides?: Partial<CreateShippingOptionType>) {
  const values = generateShippingOptionType(overrides)
  const result = await db.insert(shippingOptionTypeTable).values(values).returning()
  const shippingOptionType = result[0]
  if (!shippingOptionType) throw new Error('ShippingOptionType insert returned no rows')

  return {
    ...shippingOptionType,
    [Symbol.asyncDispose]: async () => {
      await deleteShippingOptionTypeById(shippingOptionType.id)
    },
  }
}

export async function deleteShippingOptionTypeById(id: string) {
  await db.delete(shippingOptionTypeTable).where(eq(shippingOptionTypeTable.id, id))
}

// --- ShippingOption ---

export function generateShippingOption(overrides?: Partial<CreateShippingOption>): CreateShippingOption {
  return {
    name: faker.helpers.arrayElement(['Standard Shipping', 'Express Shipping', 'Overnight Shipping']),
    priceType: faker.helpers.arrayElement(['flat', 'calculated']),
    amount: faker.number.int({ min: 100, max: 5000 }),
    serviceZoneId: `serzo_${faker.string.alphanumeric(32)}`,
    shippingProfileId: `sp_${faker.string.alphanumeric(32)}`,
    shippingOptionTypeId: null,
    providerId: `fp_${faker.string.alphanumeric(20)}`,
    data: null,
    metadata: null,
    isEnabled: faker.datatype.boolean(),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createShippingOption(overrides?: Partial<CreateShippingOption>) {
  const values = generateShippingOption(overrides)
  const result = await db.insert(shippingOptionTable).values(values).returning()
  const shippingOption = result[0]
  if (!shippingOption) throw new Error('ShippingOption insert returned no rows')

  return {
    ...shippingOption,
    [Symbol.asyncDispose]: async () => {
      await deleteShippingOptionById(shippingOption.id)
    },
  }
}

export async function deleteShippingOptionById(id: string) {
  await db.delete(shippingOptionTable).where(eq(shippingOptionTable.id, id))
}
