import type { Context } from '@core/types/context.js'

export type FixtureShippingRateDTO = {
  id: string
  city: string
  /** What a parcel costs to the city before its items, in the currency's minor units. */
  baseAmount: number
  /** What each unit in the parcel adds. */
  perItemAmount: number
  deliveryDays: number
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type CreateFixtureShippingRateDTO = Pick<
  FixtureShippingRateDTO,
  'city' | 'baseAmount' | 'perItemAmount' | 'deliveryDays'
>

/** The rate table a courier quotes from, which the fixture's fulfillment provider reads. */
export type IFixtureShippingRatesService = {
  createShippingRates(data: CreateFixtureShippingRateDTO[], context?: Context): Promise<FixtureShippingRateDTO[]>
  /** The rate for a city, compared trimmed and case-insensitively; null when the table has none. */
  findRateForCity(city: string, context?: Context): Promise<FixtureShippingRateDTO | null>
}
