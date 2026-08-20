import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type { CalculatedPriceSetDTO, FilterablePriceProps, PriceDTO, PriceSetDTO, PricingContext } from './common.js'
import type { CreatePriceDTO, CreatePriceSetDTO, UpdatePriceDTO, UpsertPriceSetDTO } from './mutations.js'

export type IPricingModuleService = {
  createPriceSet(data: CreatePriceSetDTO, context?: Context): Promise<PriceSetDTO>
  createPriceSets(data: CreatePriceSetDTO[], context?: Context): Promise<PriceSetDTO[]>
  upsertPriceSets(data: UpsertPriceSetDTO[], context?: Context): Promise<PriceSetDTO[]>
  deletePriceSets(priceSetIds: string[], context?: Context): Promise<void>
  addPrice(priceSetId: string, price: CreatePriceDTO, context?: Context): Promise<PriceDTO>
  addPrices(priceSetId: string, prices: CreatePriceDTO[], context?: Context): Promise<PriceDTO[]>
  updatePrice(priceId: string, data: UpdatePriceDTO, context?: Context): Promise<PriceDTO>
  updatePrices(priceIds: string[], data: UpdatePriceDTO, context?: Context): Promise<PriceDTO[]>
  removePrices(priceIds: string[], context?: Context): Promise<void>
  listPrices(filters?: FilterablePriceProps, config?: FindConfig<PriceDTO>, context?: Context): Promise<PriceDTO[]>
  calculatePrices(
    priceSetIds: string[],
    pricingContext: PricingContext,
    context?: Context,
  ): Promise<CalculatedPriceSetDTO[]>
}
