import { z } from 'zod'
import { dateToIso, timestamps } from '../../common.js'

export const AdminFulfillmentProvider = z
  .object({
    id: z.string(),
    isEnabled: z.boolean(),
    deletedAt: dateToIso.nullable(),
  })
  .openapi('AdminFulfillmentProvider')
export type AdminFulfillmentProvider = z.input<typeof AdminFulfillmentProvider>

export const AdminFulfillmentSet = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    metadata: z.string().nullable(),
    ...timestamps.shape,
  })
  .openapi('AdminFulfillmentSet')
export type AdminFulfillmentSet = z.input<typeof AdminFulfillmentSet>

export const AdminServiceZone = z
  .object({
    id: z.string(),
    name: z.string(),
    fulfillmentSetId: z.string(),
    metadata: z.string().nullable(),
    ...timestamps.shape,
  })
  .openapi('AdminServiceZone')
export type AdminServiceZone = z.input<typeof AdminServiceZone>

export const AdminGeoZone = z
  .object({
    id: z.string(),
    type: z.enum(['country', 'province', 'city', 'zip']),
    countryCode: z.string(),
    provinceCode: z.string().nullable(),
    city: z.string().nullable(),
    postalExpression: z.string().nullable(),
    serviceZoneId: z.string(),
    metadata: z.string().nullable(),
    ...timestamps.shape,
  })
  .openapi('AdminGeoZone')
export type AdminGeoZone = z.input<typeof AdminGeoZone>

export const AdminShippingProfile = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    metadata: z.string().nullable(),
    ...timestamps.shape,
  })
  .openapi('AdminShippingProfile')
export type AdminShippingProfile = z.input<typeof AdminShippingProfile>

export const AdminShippingOption = z
  .object({
    id: z.string(),
    name: z.string(),
    priceType: z.enum(['flat', 'calculated']),
    amount: z.number().nullable(),
    serviceZoneId: z.string(),
    shippingProfileId: z.string(),
    shippingOptionTypeId: z.string().nullable(),
    providerId: z.string(),
    data: z.record(z.string(), z.unknown()).nullable(),
    metadata: z.string().nullable(),
    isEnabled: z.boolean(),
    ...timestamps.shape,
  })
  .openapi('AdminShippingOption')
export type AdminShippingOption = z.input<typeof AdminShippingOption>
