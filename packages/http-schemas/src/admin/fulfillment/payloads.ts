import { z } from 'zod'
import { countryCode, entityId, longText, MAX_ITEMS, machineCode, shortText } from '../../bounded.js'

export const AdminCreateFulfillmentSet = z
  .object({
    name: shortText.min(1),
    type: machineCode.min(1),
  })
  .openapi('AdminCreateFulfillmentSet')
export type AdminCreateFulfillmentSetBody = z.infer<typeof AdminCreateFulfillmentSet>

export const AdminUpdateFulfillmentSet = z
  .object({
    name: shortText.min(1).optional(),
    type: machineCode.min(1).optional(),
  })
  .openapi('AdminUpdateFulfillmentSet')
export type AdminUpdateFulfillmentSetBody = z.infer<typeof AdminUpdateFulfillmentSet>

export const AdminCreateGeoZoneInput = z.object({
  type: z.enum(['country', 'province', 'city', 'zip']),
  countryCode: countryCode.length(2),
  provinceCode: machineCode.optional(),
  city: shortText.optional(),
  // Prose rather than a code: a zip zone's expression is a written list of ranges.
  postalExpression: longText.optional(),
})

export const AdminCreateServiceZone = z
  .object({
    name: shortText.min(1),
    geoZones: z.array(AdminCreateGeoZoneInput).max(MAX_ITEMS.bulk).optional(),
  })
  .openapi('AdminCreateServiceZone')
export type AdminCreateServiceZoneBody = z.infer<typeof AdminCreateServiceZone>

export const AdminUpdateServiceZone = z
  .object({
    name: shortText.min(1).optional(),
  })
  .openapi('AdminUpdateServiceZone')
export type AdminUpdateServiceZoneBody = z.infer<typeof AdminUpdateServiceZone>

export const AdminCreateGeoZone = AdminCreateGeoZoneInput.openapi('AdminCreateGeoZone')
export type AdminCreateGeoZoneBody = z.infer<typeof AdminCreateGeoZone>

export const AdminCreateShippingProfile = z
  .object({
    name: shortText.min(1),
    type: machineCode.min(1),
  })
  .openapi('AdminCreateShippingProfile')
export type AdminCreateShippingProfileBody = z.infer<typeof AdminCreateShippingProfile>

export const AdminUpdateShippingProfile = z
  .object({
    name: shortText.min(1).optional(),
    type: machineCode.min(1).optional(),
  })
  .openapi('AdminUpdateShippingProfile')
export type AdminUpdateShippingProfileBody = z.infer<typeof AdminUpdateShippingProfile>

export const AdminCreateShippingOption = z
  .object({
    name: shortText.min(1),
    priceType: z.enum(['flat', 'calculated']),
    amount: z.number().int().min(0).optional(),
    serviceZoneId: entityId.min(1),
    shippingProfileId: entityId.min(1),
    shippingOptionTypeId: entityId.optional(),
    providerId: entityId.min(1),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('AdminCreateShippingOption')
export type AdminCreateShippingOptionBody = z.infer<typeof AdminCreateShippingOption>

export const AdminUpdateShippingOption = z
  .object({
    name: shortText.min(1).optional(),
    amount: z.number().int().min(0).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    isEnabled: z.boolean().optional(),
  })
  .openapi('AdminUpdateShippingOption')
export type AdminUpdateShippingOptionBody = z.infer<typeof AdminUpdateShippingOption>

export const AdminZoneIdParams = z.object({
  id: entityId.min(1),
  zoneId: entityId.min(1),
})
export type AdminZoneIdParams = z.infer<typeof AdminZoneIdParams>
