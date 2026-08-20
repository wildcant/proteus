import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { Context } from '../../../core/types/context.js'
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
} from '../../../core/types/fulfillment/common.js'
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
} from '../../../core/types/fulfillment/mutations.js'
import type { IFulfillmentModuleService, ShippingAddressContext } from '../../../core/types/fulfillment/service.js'
import type { Logger } from '../../../core/types/logger.js'
import type { WithTransaction } from '../../../core/utils/with-transaction.js'
import type { FulfillmentRepository } from '../repositories/fulfillment.js'
import type { FulfillmentAddressRepository } from '../repositories/fulfillment-address.js'
import type { FulfillmentItemRepository } from '../repositories/fulfillment-item.js'
import type { FulfillmentSetRepository } from '../repositories/fulfillment-set.js'
import type { GeoZoneRepository } from '../repositories/geo-zone.js'
import type { ServiceZoneRepository } from '../repositories/service-zone.js'
import type { ShippingOptionRepository } from '../repositories/shipping-option.js'
import type { ShippingOptionTypeRepository } from '../repositories/shipping-option-type.js'
import type { ShippingProfileRepository } from '../repositories/shipping-profile.js'
import type { FulfillmentProviderService } from './fulfillment-provider-service.js'

type InjectedDependencies = {
  fulfillmentSetRepository: FulfillmentSetRepository
  serviceZoneRepository: ServiceZoneRepository
  geoZoneRepository: GeoZoneRepository
  shippingProfileRepository: ShippingProfileRepository
  shippingOptionTypeRepository: ShippingOptionTypeRepository
  shippingOptionRepository: ShippingOptionRepository
  fulfillmentRepository: FulfillmentRepository
  fulfillmentItemRepository: FulfillmentItemRepository
  fulfillmentAddressRepository: FulfillmentAddressRepository
  fulfillmentProviderService: FulfillmentProviderService
  withTransaction: WithTransaction
  logger: Logger
}

export class FulfillmentModuleService implements IFulfillmentModuleService {
  private fulfillmentSetRepository: FulfillmentSetRepository
  private serviceZoneRepository: ServiceZoneRepository
  private geoZoneRepository: GeoZoneRepository
  private shippingProfileRepository: ShippingProfileRepository
  private shippingOptionTypeRepository: ShippingOptionTypeRepository
  private shippingOptionRepository: ShippingOptionRepository
  private fulfillmentRepository: FulfillmentRepository
  private fulfillmentItemRepository: FulfillmentItemRepository
  private fulfillmentAddressRepository: FulfillmentAddressRepository
  private fulfillmentProviderService: FulfillmentProviderService
  private withTransaction: WithTransaction
  private logger: Logger

  constructor({
    fulfillmentSetRepository,
    serviceZoneRepository,
    geoZoneRepository,
    shippingProfileRepository,
    shippingOptionTypeRepository,
    shippingOptionRepository,
    fulfillmentRepository,
    fulfillmentItemRepository,
    fulfillmentAddressRepository,
    fulfillmentProviderService,
    withTransaction,
    logger,
  }: InjectedDependencies) {
    this.fulfillmentSetRepository = fulfillmentSetRepository
    this.serviceZoneRepository = serviceZoneRepository
    this.geoZoneRepository = geoZoneRepository
    this.shippingProfileRepository = shippingProfileRepository
    this.shippingOptionTypeRepository = shippingOptionTypeRepository
    this.shippingOptionRepository = shippingOptionRepository
    this.fulfillmentRepository = fulfillmentRepository
    this.fulfillmentItemRepository = fulfillmentItemRepository
    this.fulfillmentAddressRepository = fulfillmentAddressRepository
    this.fulfillmentProviderService = fulfillmentProviderService
    this.withTransaction = withTransaction
    this.logger = logger
  }

  // -- FulfillmentSet --

  async createFulfillmentSets(data: CreateFulfillmentSetDTO[], context?: Context): Promise<FulfillmentSetDTO[]> {
    this.logger.debug(`Creating ${data.length} fulfillment set(s)`)
    return this.fulfillmentSetRepository.createMany(data, context)
  }

  async retrieveFulfillmentSet(
    id: string,
    config?: FindConfig<FulfillmentSetDTO>,
    context?: Context,
  ): Promise<FulfillmentSetDTO> {
    return this.fulfillmentSetRepository.findByIdOrFail(id, config, context)
  }

  async listFulfillmentSets(
    filters?: FilterableFulfillmentSetProps,
    config?: FindConfig<FulfillmentSetDTO>,
    context?: Context,
  ): Promise<FulfillmentSetDTO[]> {
    return this.fulfillmentSetRepository.find(filters, config, context)
  }

  async updateFulfillmentSets(
    ids: string[],
    data: UpdateFulfillmentSetDTO,
    context?: Context,
  ): Promise<FulfillmentSetDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.fulfillmentSetRepository.updateMany(ids, data, ctx)
    })
  }

  async createFulfillmentSet(data: CreateFulfillmentSetDTO, context?: Context): Promise<FulfillmentSetDTO> {
    return this.fulfillmentSetRepository.create(data, context)
  }

  async updateFulfillmentSet(id: string, data: UpdateFulfillmentSetDTO, context?: Context): Promise<FulfillmentSetDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.fulfillmentSetRepository.update(id, data, ctx)
    })
  }

  async deleteFulfillmentSets(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.fulfillmentSetRepository.delete(ids, ctx)
    })
  }

  async softDeleteFulfillmentSets(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.fulfillmentSetRepository.softDelete(ids, ctx)
    })
  }

  // -- ServiceZone --

  async createServiceZones(data: CreateServiceZoneDTO[], context?: Context): Promise<ServiceZoneDTO[]> {
    this.logger.debug(`Creating ${data.length} service zone(s)`)
    return this.withTransaction(context, async (ctx) => {
      const zones = await this.serviceZoneRepository.createMany(
        data.map(({ geoZones: _, ...zone }) => zone),
        ctx,
      )

      // Create nested geo zones if provided
      const geoZoneInputs = data.flatMap((item, i) => {
        const zone = zones[i]
        if (!zone || !item.geoZones?.length) return []
        return item.geoZones.map((gz) => ({ ...gz, serviceZoneId: zone.id }))
      })

      if (geoZoneInputs.length) {
        await this.geoZoneRepository.createMany(geoZoneInputs, ctx)
      }

      return zones
    })
  }

  async retrieveServiceZone(
    id: string,
    config?: FindConfig<ServiceZoneDTO>,
    context?: Context,
  ): Promise<ServiceZoneDTO> {
    return this.serviceZoneRepository.findByIdOrFail(id, config, context)
  }

  async listServiceZones(
    filters?: FilterableServiceZoneProps,
    config?: FindConfig<ServiceZoneDTO>,
    context?: Context,
  ): Promise<ServiceZoneDTO[]> {
    return this.serviceZoneRepository.find(filters, config, context)
  }

  async updateServiceZones(ids: string[], data: UpdateServiceZoneDTO, context?: Context): Promise<ServiceZoneDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.serviceZoneRepository.updateMany(ids, data, ctx)
    })
  }

  async createServiceZone(data: CreateServiceZoneDTO, context?: Context): Promise<ServiceZoneDTO> {
    return this.withTransaction(context, async (ctx) => {
      const { geoZones: geoZoneInputs, ...zoneData } = data
      const zone = await this.serviceZoneRepository.create(zoneData, ctx)

      if (geoZoneInputs?.length) {
        await this.geoZoneRepository.createMany(
          geoZoneInputs.map((gz) => ({ ...gz, serviceZoneId: zone.id })),
          ctx,
        )
      }

      return zone
    })
  }

  async updateServiceZone(id: string, data: UpdateServiceZoneDTO, context?: Context): Promise<ServiceZoneDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.serviceZoneRepository.update(id, data, ctx)
    })
  }

  async deleteServiceZones(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.serviceZoneRepository.delete(ids, ctx)
    })
  }

  // -- GeoZone --

  async createGeoZones(data: CreateGeoZoneDTO[], context?: Context): Promise<GeoZoneDTO[]> {
    this.logger.debug(`Creating ${data.length} geo zone(s)`)
    return this.geoZoneRepository.createMany(
      data.map((gz) => {
        if (!gz.serviceZoneId) {
          throw new AppError({
            type: ErrorTypes.INVALID_DATA,
            message: 'serviceZoneId is required when creating geo zones directly',
          })
        }
        return { ...gz, serviceZoneId: gz.serviceZoneId }
      }),
      context,
    ) as Promise<GeoZoneDTO[]>
  }

  async listGeoZones(
    filters?: FilterableGeoZoneProps,
    config?: FindConfig<GeoZoneDTO>,
    context?: Context,
  ): Promise<GeoZoneDTO[]> {
    return this.geoZoneRepository.find(filters, config, context) as Promise<GeoZoneDTO[]>
  }

  async updateGeoZones(ids: string[], data: UpdateGeoZoneDTO, context?: Context): Promise<GeoZoneDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.geoZoneRepository.updateMany(ids, data, ctx) as Promise<GeoZoneDTO[]>
    })
  }

  async createGeoZone(data: CreateGeoZoneDTO, context?: Context): Promise<GeoZoneDTO> {
    if (!data.serviceZoneId) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: 'serviceZoneId is required when creating geo zones directly',
      })
    }
    return this.geoZoneRepository.create({ ...data, serviceZoneId: data.serviceZoneId }, context) as Promise<GeoZoneDTO>
  }

  async updateGeoZone(id: string, data: UpdateGeoZoneDTO, context?: Context): Promise<GeoZoneDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.geoZoneRepository.update(id, data, ctx) as Promise<GeoZoneDTO>
    })
  }

  async deleteGeoZones(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.geoZoneRepository.delete(ids, ctx)
    })
  }

  // -- ShippingProfile --

  async createShippingProfiles(data: CreateShippingProfileDTO[], context?: Context): Promise<ShippingProfileDTO[]> {
    this.logger.debug(`Creating ${data.length} shipping profile(s)`)
    return this.shippingProfileRepository.createMany(data, context)
  }

  async listShippingProfiles(
    filters?: FilterableShippingProfileProps,
    config?: FindConfig<ShippingProfileDTO>,
    context?: Context,
  ): Promise<ShippingProfileDTO[]> {
    return this.shippingProfileRepository.find(filters, config, context)
  }

  async updateShippingProfiles(
    ids: string[],
    data: UpdateShippingProfileDTO,
    context?: Context,
  ): Promise<ShippingProfileDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.shippingProfileRepository.updateMany(ids, data, ctx)
    })
  }

  async createShippingProfile(data: CreateShippingProfileDTO, context?: Context): Promise<ShippingProfileDTO> {
    return this.shippingProfileRepository.create(data, context)
  }

  async updateShippingProfile(
    id: string,
    data: UpdateShippingProfileDTO,
    context?: Context,
  ): Promise<ShippingProfileDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.shippingProfileRepository.update(id, data, ctx)
    })
  }

  async deleteShippingProfiles(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.shippingProfileRepository.delete(ids, ctx)
    })
  }

  // -- ShippingOptionType --

  async createShippingOptionTypes(
    data: CreateShippingOptionTypeDTO[],
    context?: Context,
  ): Promise<ShippingOptionTypeDTO[]> {
    this.logger.debug(`Creating ${data.length} shipping option type(s)`)
    return this.shippingOptionTypeRepository.createMany(data, context)
  }

  async listShippingOptionTypes(
    filters?: FilterableGeoZoneProps,
    config?: FindConfig<ShippingOptionTypeDTO>,
    context?: Context,
  ): Promise<ShippingOptionTypeDTO[]> {
    return this.shippingOptionTypeRepository.find(filters, config, context)
  }

  async updateShippingOptionTypes(
    ids: string[],
    data: UpdateShippingOptionTypeDTO,
    context?: Context,
  ): Promise<ShippingOptionTypeDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.shippingOptionTypeRepository.updateMany(ids, data, ctx)
    })
  }

  async createShippingOptionType(data: CreateShippingOptionTypeDTO, context?: Context): Promise<ShippingOptionTypeDTO> {
    return this.shippingOptionTypeRepository.create(data, context)
  }

  async updateShippingOptionType(
    id: string,
    data: UpdateShippingOptionTypeDTO,
    context?: Context,
  ): Promise<ShippingOptionTypeDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.shippingOptionTypeRepository.update(id, data, ctx)
    })
  }

  async deleteShippingOptionTypes(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.shippingOptionTypeRepository.delete(ids, ctx)
    })
  }

  // -- ShippingOption --

  async createShippingOptions(data: CreateShippingOptionDTO[], context?: Context): Promise<ShippingOptionDTO[]> {
    this.logger.debug(`Creating ${data.length} shipping option(s)`)
    return this.shippingOptionRepository.createMany(data, context) as Promise<ShippingOptionDTO[]>
  }

  async retrieveShippingOption(
    id: string,
    config?: FindConfig<ShippingOptionDTO>,
    context?: Context,
  ): Promise<ShippingOptionDTO> {
    return this.shippingOptionRepository.findByIdOrFail(id, config, context) as Promise<ShippingOptionDTO>
  }

  async listShippingOptions(
    filters?: FilterableShippingOptionProps,
    config?: FindConfig<ShippingOptionDTO>,
    context?: Context,
  ): Promise<ShippingOptionDTO[]> {
    return this.shippingOptionRepository.find(filters, config, context) as Promise<ShippingOptionDTO[]>
  }

  async listShippingOptionsForContext(
    address: ShippingAddressContext,
    context?: Context,
  ): Promise<ShippingOptionDTO[]> {
    // 1. Find all geo zones matching the address
    const matchingGeoZones = await this.geoZoneRepository.findMatchingZones(address, context)

    if (matchingGeoZones.length === 0) return []

    // 2. Collect unique service zone IDs
    const serviceZoneIds = [...new Set(matchingGeoZones.map((gz) => gz.serviceZoneId))]

    // 3. Find enabled shipping options in those service zones
    const options = await this.shippingOptionRepository.findByServiceZoneIds(serviceZoneIds, context)

    return options as ShippingOptionDTO[]
  }

  async updateShippingOptions(
    ids: string[],
    data: UpdateShippingOptionDTO,
    context?: Context,
  ): Promise<ShippingOptionDTO[]> {
    return this.withTransaction(context, async (ctx) => {
      return this.shippingOptionRepository.updateMany(ids, data, ctx) as Promise<ShippingOptionDTO[]>
    })
  }

  async createShippingOption(data: CreateShippingOptionDTO, context?: Context): Promise<ShippingOptionDTO> {
    return this.shippingOptionRepository.create(data, context) as Promise<ShippingOptionDTO>
  }

  async updateShippingOption(id: string, data: UpdateShippingOptionDTO, context?: Context): Promise<ShippingOptionDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.shippingOptionRepository.update(id, data, ctx) as Promise<ShippingOptionDTO>
    })
  }

  async deleteShippingOptions(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.shippingOptionRepository.delete(ids, ctx)
    })
  }

  async softDeleteShippingOptions(ids: string[], context?: Context): Promise<void> {
    return this.withTransaction(context, async (ctx) => {
      await this.shippingOptionRepository.softDelete(ids, ctx)
    })
  }

  // -- FulfillmentProvider --

  async listFulfillmentProviders(
    filters?: FilterableFulfillmentProviderProps,
    config?: FindConfig<FulfillmentProviderDTO>,
    context?: Context,
  ): Promise<FulfillmentProviderDTO[]> {
    return this.fulfillmentProviderService.list(filters, config, context)
  }

  // -- Fulfillment lifecycle --

  async createFulfillment(data: CreateFulfillmentDTO, context?: Context): Promise<FulfillmentDTO> {
    this.logger.debug(`Creating fulfillment with provider "${data.providerId}"`)

    return this.withTransaction(context, async (ctx) => {
      // Create the fulfillment record
      const fulfillment = await this.fulfillmentRepository.create(
        {
          locationId: data.locationId,
          providerId: data.providerId,
          shippingOptionId: data.shippingOptionId,
          data: data.data,
          requiresShipping: data.requiresShipping ?? true,
          metadata: data.metadata,
        },
        ctx,
      )

      // Create items
      if (data.items.length) {
        await this.fulfillmentItemRepository.createMany(
          data.items.map((item) => ({ ...item, fulfillmentId: fulfillment.id })),
          ctx,
        )
      }

      // Create address
      await this.fulfillmentAddressRepository.create({ ...data.address, fulfillmentId: fulfillment.id }, ctx)

      // Delegate to provider
      const providerResult = await this.fulfillmentProviderService
        .createFulfillment(data.providerId, {
          data: (data.data as Record<string, unknown>) ?? {},
          items: data.items,
          fulfillment: fulfillment as unknown as Record<string, unknown>,
        })
        .catch((e) => {
          this.logger.error(e)
          return null
        })

      // Update with provider response data if available
      if (providerResult?.data && Object.keys(providerResult.data).length > 0) {
        const updated = await this.fulfillmentRepository.update(fulfillment.id, { data: providerResult.data }, ctx)
        return updated as FulfillmentDTO
      }

      return fulfillment as FulfillmentDTO
    })
  }

  async retrieveFulfillment(
    id: string,
    config?: FindConfig<FulfillmentDTO>,
    context?: Context,
  ): Promise<FulfillmentDTO> {
    return this.fulfillmentRepository.findByIdOrFail(id, config, context) as Promise<FulfillmentDTO>
  }

  async retrieveFulfillmentItems(fulfillmentId: string, context?: Context): Promise<FulfillmentItemDTO[]> {
    return this.fulfillmentItemRepository.find({ fulfillmentId }, undefined, context)
  }

  async retrieveFulfillmentAddress(fulfillmentId: string, context?: Context): Promise<FulfillmentAddressDTO | null> {
    return this.fulfillmentAddressRepository.findOne({ fulfillmentId }, undefined, context)
  }

  async listFulfillments(
    filters?: FilterableFulfillmentProps,
    config?: FindConfig<FulfillmentDTO>,
    context?: Context,
  ): Promise<FulfillmentDTO[]> {
    return this.fulfillmentRepository.find(filters, config, context) as Promise<FulfillmentDTO[]>
  }

  async updateFulfillment(id: string, data: UpdateFulfillmentDTO, context?: Context): Promise<FulfillmentDTO> {
    return this.withTransaction(context, async (ctx) => {
      return this.fulfillmentRepository.update(id, data, ctx) as Promise<FulfillmentDTO>
    })
  }

  async cancelFulfillment(id: string, context?: Context): Promise<FulfillmentDTO> {
    return this.withTransaction(context, async (ctx) => {
      const fulfillment = await this.fulfillmentRepository.findByIdOrFail(id, undefined, ctx)

      if (fulfillment.shippedAt) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Fulfillment "${id}" has already been shipped and cannot be canceled`,
        })
      }

      if (fulfillment.deliveredAt) {
        throw new AppError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Fulfillment "${id}" has already been delivered and cannot be canceled`,
        })
      }

      if (fulfillment.canceledAt) {
        return fulfillment as FulfillmentDTO
      }

      // Delegate to provider
      await this.fulfillmentProviderService
        .cancelFulfillment(fulfillment.providerId, fulfillment as unknown as Record<string, unknown>)
        .catch((e) => this.logger.error(e))

      const updated = await this.fulfillmentRepository.update(id, { canceledAt: new Date() }, ctx)

      return updated as FulfillmentDTO
    })
  }
}
