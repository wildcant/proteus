import type { GeoZoneType, ShippingOptionPriceType } from './common.js'

// FulfillmentSet

export type CreateFulfillmentSetDTO = {
  name: string
  type: string
  metadata?: string | null | undefined
}

export type UpdateFulfillmentSetDTO = {
  name?: string | undefined
  type?: string | undefined
  metadata?: string | null | undefined
}

// ServiceZone

export type CreateServiceZoneDTO = {
  name: string
  fulfillmentSetId: string
  geoZones?: CreateGeoZoneDTO[] | undefined
  metadata?: string | null | undefined
}

export type UpdateServiceZoneDTO = {
  name?: string | undefined
  metadata?: string | null | undefined
}

// GeoZone

export type CreateGeoZoneDTO = {
  type: GeoZoneType
  countryCode: string
  provinceCode?: string | null | undefined
  city?: string | null | undefined
  postalExpression?: string | null | undefined
  serviceZoneId?: string | undefined
}

export type UpdateGeoZoneDTO = {
  type?: GeoZoneType | undefined
  countryCode?: string | undefined
  provinceCode?: string | null | undefined
  city?: string | null | undefined
  postalExpression?: string | null | undefined
}

// ShippingProfile

export type CreateShippingProfileDTO = {
  name: string
  type: string
  metadata?: string | null | undefined
}

export type UpdateShippingProfileDTO = {
  name?: string | undefined
  type?: string | undefined
  metadata?: string | null | undefined
}

// ShippingOptionType

export type CreateShippingOptionTypeDTO = {
  label: string
  description?: string | null | undefined
  code: string
}

export type UpdateShippingOptionTypeDTO = {
  label?: string | undefined
  description?: string | null | undefined
  code?: string | undefined
}

// ShippingOption

export type CreateShippingOptionDTO = {
  name: string
  priceType: ShippingOptionPriceType
  amount?: number | null | undefined
  serviceZoneId: string
  shippingProfileId: string
  shippingOptionTypeId?: string | null | undefined
  providerId: string
  data?: Record<string, unknown> | null | undefined
  metadata?: string | null | undefined
}

export type UpdateShippingOptionDTO = {
  name?: string | undefined
  amount?: number | null | undefined
  data?: Record<string, unknown> | null | undefined
  metadata?: string | null | undefined
  isEnabled?: boolean | undefined
}

// FulfillmentProvider

export type CreateFulfillmentProviderDTO = {
  id: string
  isEnabled?: boolean | undefined
}

// Fulfillment

export type CreateFulfillmentDTO = {
  locationId?: string | null | undefined
  providerId: string
  shippingOptionId?: string | null | undefined
  data?: unknown | undefined
  requiresShipping?: boolean | undefined
  items: CreateFulfillmentItemDTO[]
  address: CreateFulfillmentAddressDTO
  metadata?: string | null | undefined
}

export type UpdateFulfillmentDTO = {
  data?: unknown | undefined
  packedAt?: Date | null | undefined
  shippedAt?: Date | null | undefined
  deliveredAt?: Date | null | undefined
  canceledAt?: Date | null | undefined
  metadata?: string | null | undefined
}

// FulfillmentItem

export type CreateFulfillmentItemDTO = {
  title: string
  quantity: number
  sku?: string | null | undefined
  barcode?: string | null | undefined
  lineItemId?: string | null | undefined
  inventoryItemId?: string | null | undefined
  metadata?: string | null | undefined
}

// FulfillmentAddress

export type CreateFulfillmentAddressDTO = {
  company?: string | null | undefined
  firstName?: string | null | undefined
  lastName?: string | null | undefined
  address1?: string | null | undefined
  address2?: string | null | undefined
  city?: string | null | undefined
  countryCode?: string | null | undefined
  province?: string | null | undefined
  postalCode?: string | null | undefined
  phone?: string | null | undefined
  metadata?: string | null | undefined
}
