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

export type ShippingAddressContext = {
  countryCode: string
  province?: string
  city?: string
  postalCode?: string
}

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
