import type { BaseFilterable, OperatorMap } from '../common.js'

export type GeoZoneType = 'country' | 'province' | 'city' | 'zip'

export type ShippingOptionPriceType = 'flat' | 'calculated'

export type FulfillmentSetDTO = {
  id: string
  name: string
  type: string
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ServiceZoneDTO = {
  id: string
  name: string
  fulfillmentSetId: string
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type GeoZoneDTO = {
  id: string
  type: GeoZoneType
  countryCode: string
  provinceCode: string | null
  city: string | null
  postalExpression: string | null
  serviceZoneId: string
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ShippingProfileDTO = {
  id: string
  name: string
  type: string
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ShippingOptionTypeDTO = {
  id: string
  label: string
  description: string | null
  code: string
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type ShippingOptionDTO = {
  id: string
  name: string
  priceType: ShippingOptionPriceType
  amount: number | null
  serviceZoneId: string
  shippingProfileId: string
  shippingOptionTypeId: string | null
  providerId: string
  data: Record<string, unknown> | null
  metadata: string | null
  isEnabled: boolean
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type FulfillmentProviderDTO = {
  id: string
  isEnabled: boolean
  deletedAt: Date | null
}

export type FulfillmentDTO = {
  id: string
  locationId: string | null
  providerId: string
  shippingOptionId: string | null
  data: unknown
  requiresShipping: boolean
  packedAt: Date | null
  shippedAt: Date | null
  deliveredAt: Date | null
  canceledAt: Date | null
  metadata: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

export type FulfillmentItemDTO = {
  id: string
  fulfillmentId: string
  title: string
  quantity: number
  sku: string | null
  barcode: string | null
  lineItemId: string | null
  inventoryItemId: string | null
  metadata: string | null
  createdAt: Date
  deletedAt: Date | null
}

export type FulfillmentAddressDTO = {
  id: string
  fulfillmentId: string
  company: string | null
  firstName: string | null
  lastName: string | null
  address1: string | null
  address2: string | null
  city: string | null
  countryCode: string | null
  province: string | null
  postalCode: string | null
  phone: string | null
  metadata: string | null
  createdAt: Date
  deletedAt: Date | null
}

// Filterable types

export interface FilterableFulfillmentSetProps extends BaseFilterable<FilterableFulfillmentSetProps> {
  id?: string | string[]
  name?: string | OperatorMap<string>
  type?: string | string[]
}

export interface FilterableServiceZoneProps extends BaseFilterable<FilterableServiceZoneProps> {
  id?: string | string[]
  name?: string | OperatorMap<string>
  fulfillmentSetId?: string | string[]
}

export interface FilterableGeoZoneProps extends BaseFilterable<FilterableGeoZoneProps> {
  id?: string | string[]
  type?: GeoZoneType | GeoZoneType[]
  countryCode?: string | string[]
  serviceZoneId?: string | string[]
}

export interface FilterableShippingOptionProps extends BaseFilterable<FilterableShippingOptionProps> {
  id?: string | string[]
  name?: string | OperatorMap<string>
  priceType?: ShippingOptionPriceType | ShippingOptionPriceType[]
  serviceZoneId?: string | string[]
  shippingProfileId?: string | string[]
  providerId?: string | string[]
  isEnabled?: boolean
}

export interface FilterableShippingProfileProps extends BaseFilterable<FilterableShippingProfileProps> {
  id?: string | string[]
  name?: string | OperatorMap<string>
  type?: string | string[]
}

export interface FilterableFulfillmentProviderProps extends BaseFilterable<FilterableFulfillmentProviderProps> {
  id?: string | string[]
  isEnabled?: boolean
}

export interface FilterableFulfillmentProps extends BaseFilterable<FilterableFulfillmentProps> {
  id?: string | string[]
  locationId?: string | string[]
  providerId?: string | string[]
  shippingOptionId?: string | string[]
}
