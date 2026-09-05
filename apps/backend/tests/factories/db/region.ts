import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import type { CreateCountry, CreateRegion, CreateRegionPaymentProvider } from '../../../src/schema.js'
import { countryTable, regionPaymentProviderTable, regionTable } from '../../../src/schema.js'
import { db } from '../../db/client.js'

// --- Region ---

export function generateRegion(overrides?: Partial<CreateRegion>): CreateRegion {
  return {
    name: faker.location.country(),
    currencyCode: faker.finance.currencyCode().toLowerCase(),
    metadata: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createRegion(overrides?: Partial<CreateRegion>) {
  const values = generateRegion(overrides)
  const result = await db.insert(regionTable).values(values).returning()
  const region = result[0]
  if (!region) throw new Error('Region insert returned no rows')

  return {
    ...region,
    [Symbol.asyncDispose]: async () => {
      await deleteRegionById(region.id)
    },
  }
}

export async function deleteRegionById(id: string) {
  await db.delete(regionTable).where(eq(regionTable.id, id))
}

// --- Country ---

/**
 * The ISO 3166-1 table is static reference data keyed by the alpha-2 code, so a country cannot be
 * generated at random: two concurrent tests picking `us` would collide on the primary key. Callers
 * pass the code they are testing with, and `id` is the only field without a default.
 */
export function generateCountry(overrides: Partial<CreateCountry> & Pick<CreateCountry, 'id'>): CreateCountry {
  const iso2 = overrides.id
  return {
    iso3: `${iso2}x`,
    numericCode: faker.string.numeric(3),
    name: iso2.toUpperCase(),
    displayName: iso2.toUpperCase(),
    regionId: null,
    localeCode: null,
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    deletedAt: null,
    ...overrides,
  }
}

export async function createCountry(overrides: Partial<CreateCountry> & Pick<CreateCountry, 'id'>) {
  const values = generateCountry(overrides)
  const result = await db.insert(countryTable).values(values).returning()
  const country = result[0]
  if (!country) throw new Error('Country insert returned no rows')

  return {
    ...country,
    [Symbol.asyncDispose]: async () => {
      await deleteCountryById(country.id)
    },
  }
}

export async function deleteCountryById(id: string) {
  await db.delete(countryTable).where(eq(countryTable.id, id))
}

// --- RegionPaymentProvider ---

/**
 * Which payment providers a region offers. Both sides are required — a link means nothing without
 * the pair it names — so this takes them rather than inventing ids no provider row would match.
 */
export async function createRegionPaymentProvider(values: CreateRegionPaymentProvider) {
  const result = await db.insert(regionPaymentProviderTable).values(values).returning()
  const link = result[0]
  if (!link) throw new Error('RegionPaymentProvider insert returned no rows')

  return {
    ...link,
    [Symbol.asyncDispose]: async () => {
      await deleteRegionPaymentProviderById(link.id)
    },
  }
}

export async function deleteRegionPaymentProviderById(id: string) {
  await db.delete(regionPaymentProviderTable).where(eq(regionPaymentProviderTable.id, id))
}
