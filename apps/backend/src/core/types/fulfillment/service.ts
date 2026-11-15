import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type {
  FilterableFulfillmentProps,
  FilterableFulfillmentProviderProps,
  FilterableFulfillmentSetProps,
  FilterableGeoZoneProps,
  FilterableServiceZoneProps,
  FilterableShippingOptionProps,
  FilterableShippingProfileProps,
  FulfillmentAddressDTO,
  FulfillmentDTO,
  FulfillmentItemDTO,
  FulfillmentProviderDTO,
  FulfillmentSetDTO,
  GeoZoneDTO,
  ServiceZoneDTO,
  ShippingOptionDTO,
  ShippingOptionTypeDTO,
  ShippingProfileDTO,
} from './common.js'
import type {
  CreateFulfillmentDTO,
  CreateFulfillmentSetDTO,
  CreateGeoZoneDTO,
  CreateServiceZoneDTO,
  CreateShippingOptionDTO,
  CreateShippingOptionTypeDTO,
  CreateShippingProfileDTO,
  UpdateFulfillmentDTO,
  UpdateFulfillmentSetDTO,
  UpdateGeoZoneDTO,
  UpdateServiceZoneDTO,
  UpdateShippingOptionDTO,
  UpdateShippingOptionTypeDTO,
  UpdateShippingProfileDTO,
} from './mutations.js'
import type { CalculatedShippingPrice, CalculateShippingPriceContext } from './provider.js'

/** The part of an address geo-zone matching reads. */
export type ShippingAddressContext = {
  countryCode: string
  province?: string | null | undefined
  city?: string | null | undefined
  postalCode?: string | null | undefined
}

/**
 * A shipping option that serves the context's address, with the price it costs there, Medusa's
 * `calculated_price`: the option's own amount when it is flat, its provider's answer when it is
 * calculated.
 */
export type PricedShippingOptionDTO = ShippingOptionDTO & { calculatedPrice: CalculatedShippingPrice }

/** One option to price, with the data a shipping method carries for it (the shopper's, or what it stored). */
export type ShippingOptionToPrice = { id: string; data?: Record<string, unknown> | null | undefined }

export type IFulfillmentModuleService = {
  // FulfillmentSet
  createFulfillmentSets(data: CreateFulfillmentSetDTO[], context?: Context): Promise<FulfillmentSetDTO[]>
  retrieveFulfillmentSet(
    id: string,
    config?: FindConfig<FulfillmentSetDTO>,
    context?: Context,
  ): Promise<FulfillmentSetDTO>
  listFulfillmentSets(
    filters?: FilterableFulfillmentSetProps,
    config?: FindConfig<FulfillmentSetDTO>,
    context?: Context,
  ): Promise<FulfillmentSetDTO[]>
  updateFulfillmentSets(ids: string[], data: UpdateFulfillmentSetDTO, context?: Context): Promise<FulfillmentSetDTO[]>
  createFulfillmentSet(data: CreateFulfillmentSetDTO, context?: Context): Promise<FulfillmentSetDTO>
  updateFulfillmentSet(id: string, data: UpdateFulfillmentSetDTO, context?: Context): Promise<FulfillmentSetDTO>
  softDeleteFulfillmentSets(ids: string[], context?: Context): Promise<void>

  // ServiceZone
  createServiceZones(data: CreateServiceZoneDTO[], context?: Context): Promise<ServiceZoneDTO[]>
  retrieveServiceZone(id: string, config?: FindConfig<ServiceZoneDTO>, context?: Context): Promise<ServiceZoneDTO>
  listServiceZones(
    filters?: FilterableServiceZoneProps,
    config?: FindConfig<ServiceZoneDTO>,
    context?: Context,
  ): Promise<ServiceZoneDTO[]>
  updateServiceZones(ids: string[], data: UpdateServiceZoneDTO, context?: Context): Promise<ServiceZoneDTO[]>
  createServiceZone(data: CreateServiceZoneDTO, context?: Context): Promise<ServiceZoneDTO>
  updateServiceZone(id: string, data: UpdateServiceZoneDTO, context?: Context): Promise<ServiceZoneDTO>
  softDeleteServiceZones(ids: string[], context?: Context): Promise<void>

  // GeoZone
  createGeoZones(data: CreateGeoZoneDTO[], context?: Context): Promise<GeoZoneDTO[]>
  listGeoZones(
    filters?: FilterableGeoZoneProps,
    config?: FindConfig<GeoZoneDTO>,
    context?: Context,
  ): Promise<GeoZoneDTO[]>
  updateGeoZones(ids: string[], data: UpdateGeoZoneDTO, context?: Context): Promise<GeoZoneDTO[]>
  createGeoZone(data: CreateGeoZoneDTO, context?: Context): Promise<GeoZoneDTO>
  updateGeoZone(id: string, data: UpdateGeoZoneDTO, context?: Context): Promise<GeoZoneDTO>
  softDeleteGeoZones(ids: string[], context?: Context): Promise<void>

  // ShippingProfile
  createShippingProfiles(data: CreateShippingProfileDTO[], context?: Context): Promise<ShippingProfileDTO[]>
  listShippingProfiles(
    filters?: FilterableShippingProfileProps,
    config?: FindConfig<ShippingProfileDTO>,
    context?: Context,
  ): Promise<ShippingProfileDTO[]>
  updateShippingProfiles(
    ids: string[],
    data: UpdateShippingProfileDTO,
    context?: Context,
  ): Promise<ShippingProfileDTO[]>
  createShippingProfile(data: CreateShippingProfileDTO, context?: Context): Promise<ShippingProfileDTO>
  updateShippingProfile(id: string, data: UpdateShippingProfileDTO, context?: Context): Promise<ShippingProfileDTO>
  softDeleteShippingProfiles(ids: string[], context?: Context): Promise<void>

  // ShippingOptionType
  createShippingOptionTypes(data: CreateShippingOptionTypeDTO[], context?: Context): Promise<ShippingOptionTypeDTO[]>
  listShippingOptionTypes(
    filters?: FilterableGeoZoneProps,
    config?: FindConfig<ShippingOptionTypeDTO>,
    context?: Context,
  ): Promise<ShippingOptionTypeDTO[]>
  updateShippingOptionTypes(
    ids: string[],
    data: UpdateShippingOptionTypeDTO,
    context?: Context,
  ): Promise<ShippingOptionTypeDTO[]>
  createShippingOptionType(data: CreateShippingOptionTypeDTO, context?: Context): Promise<ShippingOptionTypeDTO>
  updateShippingOptionType(
    id: string,
    data: UpdateShippingOptionTypeDTO,
    context?: Context,
  ): Promise<ShippingOptionTypeDTO>
  softDeleteShippingOptionTypes(ids: string[], context?: Context): Promise<void>

  // ShippingOption
  createShippingOptions(data: CreateShippingOptionDTO[], context?: Context): Promise<ShippingOptionDTO[]>
  retrieveShippingOption(
    id: string,
    config?: FindConfig<ShippingOptionDTO>,
    context?: Context,
  ): Promise<ShippingOptionDTO>
  listShippingOptions(
    filters?: FilterableShippingOptionProps,
    config?: FindConfig<ShippingOptionDTO>,
    context?: Context,
  ): Promise<ShippingOptionDTO[]>
  listShippingOptionsForContext(address: ShippingAddressContext, context?: Context): Promise<ShippingOptionDTO[]>
  /**
   * Every enabled option serving the context's address, priced for it. A calculated option its
   * provider cannot price there is left out, as one outside the address's zones is.
   */
  listPricedShippingOptionsForContext(
    pricingContext: CalculateShippingPriceContext,
    context?: Context,
  ): Promise<PricedShippingOptionDTO[]>
  /**
   * The named options, priced for a plain context (an address, items and a currency — no cart
   * required), in the order asked. An option that is disabled, does not serve the address, or that
   * its provider cannot price there is missing from the answer: that absence is how a caller learns
   * a shipping method no longer applies.
   */
  priceShippingOptionsForContext(
    options: ShippingOptionToPrice[],
    pricingContext: CalculateShippingPriceContext,
    context?: Context,
  ): Promise<PricedShippingOptionDTO[]>
  /** The option's provider's `validateFulfillmentData`: what a shipping method for it stores in `data`. */
  validateShippingOptionFulfillmentData(
    shippingOptionId: string,
    data: Record<string, unknown>,
    pricingContext: CalculateShippingPriceContext,
    context?: Context,
  ): Promise<Record<string, unknown>>
  updateShippingOptions(ids: string[], data: UpdateShippingOptionDTO, context?: Context): Promise<ShippingOptionDTO[]>
  createShippingOption(data: CreateShippingOptionDTO, context?: Context): Promise<ShippingOptionDTO>
  updateShippingOption(id: string, data: UpdateShippingOptionDTO, context?: Context): Promise<ShippingOptionDTO>
  softDeleteShippingOptions(ids: string[], context?: Context): Promise<void>

  // FulfillmentProvider
  listFulfillmentProviders(
    filters?: FilterableFulfillmentProviderProps,
    config?: FindConfig<FulfillmentProviderDTO>,
    context?: Context,
  ): Promise<FulfillmentProviderDTO[]>

  // Fulfillment lifecycle
  createFulfillment(data: CreateFulfillmentDTO, context?: Context): Promise<FulfillmentDTO>
  retrieveFulfillment(id: string, config?: FindConfig<FulfillmentDTO>, context?: Context): Promise<FulfillmentDTO>
  retrieveFulfillmentItems(fulfillmentId: string, context?: Context): Promise<FulfillmentItemDTO[]>
  retrieveFulfillmentAddress(fulfillmentId: string, context?: Context): Promise<FulfillmentAddressDTO | null>
  listFulfillments(
    filters?: FilterableFulfillmentProps,
    config?: FindConfig<FulfillmentDTO>,
    context?: Context,
  ): Promise<FulfillmentDTO[]>
  updateFulfillment(id: string, data: UpdateFulfillmentDTO, context?: Context): Promise<FulfillmentDTO>
  cancelFulfillment(id: string, context?: Context): Promise<FulfillmentDTO>
}
