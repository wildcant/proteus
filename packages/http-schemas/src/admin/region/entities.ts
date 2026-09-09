import { z } from 'zod'
import { dateToIso } from '../../common.js'
import { AdminPaymentProvider } from '../payment/entities.js'

/**
 * A country as a region lists it.
 *
 * Only what the region surfaces show — the display name a merchant reads and the ISO 3166-1
 * alpha-2 code that identifies the row. Assigning countries is its own screen, so the fields that
 * screen needs (the locale a market cannot work without) travel with it rather than here.
 */
export const AdminRegionCountry = z
  .object({
    /** ISO 3166-1 alpha-2, lowercased — the country table's own primary key. */
    id: z.string(),
    displayName: z.string(),
  })
  .openapi('AdminRegionCountry')
export type AdminRegionCountry = z.input<typeof AdminRegionCountry>

/**
 * A region: the area the store sells into, the money it settles in, and how it takes payment.
 *
 * Countries and payment providers travel with the region rather than behind their own routes
 * because neither is meaningful on its own — a region with no country sells to nobody, and a
 * provider list is what the region's payment step is drawn from. Both are small by construction:
 * a region covers a handful of countries and offers a handful of gateways.
 */
export const AdminRegion = z
  .object({
    id: z.string(),
    name: z.string(),
    /** ISO 4217, lowercased. Always one of the store's currencies — the API refuses any other. */
    currencyCode: z.string(),
    countries: z.array(AdminRegionCountry),
    paymentProviders: z.array(AdminPaymentProvider),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminRegion')
export type AdminRegion = z.input<typeof AdminRegion>

/**
 * A country as the admin's country screens list it: the ISO row, the region that sells to it, and
 * the locale that region's storefront runs in.
 *
 * Wider than `AdminRegionCountry`, and deliberately a separate shape rather than an extension of
 * it. That one answers "which countries does this region cover"; this one answers "what is the
 * store's relationship with this country", which is why it carries `regionId` — the picker needs
 * to know which countries are already spoken for, and `null` is what says a country is not
 * sellable anywhere yet.
 */
export const AdminCountry = z
  .object({
    /** ISO 3166-1 alpha-2, lowercased — the country table's own primary key. */
    id: z.string(),
    displayName: z.string(),
    /** The region that sells to this country, or `null` when the store does not sell there. */
    regionId: z.string().nullable(),
    /** BCP 47 tag, e.g. `es-CO`. Set exactly when `regionId` is. */
    localeCode: z.string().nullable(),
  })
  .openapi('AdminCountry')
export type AdminCountry = z.input<typeof AdminCountry>
