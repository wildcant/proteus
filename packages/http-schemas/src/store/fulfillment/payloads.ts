import { z } from 'zod'
import { countryCode, entityId, longText, MAX_ITEMS, machineCode, shortText } from '../../bounded.js'

// Admin - FulfillmentSet

export const CreateFulfillmentSet = z.object({
  name: shortText.min(1),
  type: machineCode.min(1),
})
export type CreateFulfillmentSetBody = z.infer<typeof CreateFulfillmentSet>

export const UpdateFulfillmentSet = z.object({
  name: shortText.min(1).optional(),
  type: machineCode.min(1).optional(),
})
export type UpdateFulfillmentSetBody = z.infer<typeof UpdateFulfillmentSet>

// Admin - ServiceZone

export const CreateGeoZoneInput = z.object({
  type: z.enum(['country', 'province', 'city', 'zip']),
  countryCode: countryCode.length(2),
  provinceCode: machineCode.optional(),
  city: shortText.optional(),
  postalExpression: longText.optional(),
})

export const CreateServiceZone = z.object({
  name: shortText.min(1),
  geoZones: z.array(CreateGeoZoneInput).max(MAX_ITEMS.bulk).optional(),
})
export type CreateServiceZoneBody = z.infer<typeof CreateServiceZone>

export const UpdateServiceZone = z.object({
  name: shortText.min(1).optional(),
})
export type UpdateServiceZoneBody = z.infer<typeof UpdateServiceZone>

// Admin - GeoZone

export const CreateGeoZone = CreateGeoZoneInput
export type CreateGeoZoneBody = z.infer<typeof CreateGeoZone>

// Admin - ShippingProfile

export const CreateShippingProfile = z.object({
  name: shortText.min(1),
  type: machineCode.min(1),
})
export type CreateShippingProfileBody = z.infer<typeof CreateShippingProfile>

export const UpdateShippingProfile = z.object({
  name: shortText.min(1).optional(),
  type: machineCode.min(1).optional(),
})
export type UpdateShippingProfileBody = z.infer<typeof UpdateShippingProfile>

// Admin - ShippingOption

export const CreateShippingOption = z.object({
  name: shortText.min(1),
  priceType: z.enum(['flat', 'calculated']),
  amount: z.number().int().min(0).optional(),
  serviceZoneId: entityId.min(1),
  shippingProfileId: entityId.min(1),
  shippingOptionTypeId: entityId.optional(),
  providerId: entityId.min(1),
  data: z.record(z.string(), z.unknown()).optional(),
})
export type CreateShippingOptionBody = z.infer<typeof CreateShippingOption>

export const UpdateShippingOption = z.object({
  name: shortText.min(1).optional(),
  amount: z.number().int().min(0).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
})
export type UpdateShippingOptionBody = z.infer<typeof UpdateShippingOption>

// Store - Add shipping method to cart

export const AddCartShippingMethod = z.object({
  shippingOptionId: entityId.min(1),
  data: z.record(z.string(), z.unknown()).optional(),
})
export type AddCartShippingMethodBody = z.infer<typeof AddCartShippingMethod>

// Params

export const ZoneIdParams = z.object({
  id: entityId.min(1),
  zoneId: entityId.min(1),
})
export type ZoneIdParams = z.infer<typeof ZoneIdParams>
