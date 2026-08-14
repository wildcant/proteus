import type { FindConfig } from '../common.js'
import type { Context } from '../context.js'
import type { CalculatedPriceSet, FilterablePriceProps, PriceDTO, PriceSetDTO, PricingContext } from './common.js'
import type { CreatePriceDTO, CreatePriceSetDTO, UpdatePriceDTO } from './mutations.js'

export type IPricingModuleService = {
  createPriceSets(data: CreatePriceSetDTO[], context?: Context): Promise<PriceSetDTO[]>
  deletePriceSets(priceSetIds: string[], context?: Context): Promise<void>
  addPrices(priceSetId: string, prices: CreatePriceDTO[], context?: Context): Promise<PriceDTO[]>
  updatePrices(priceIds: string[], data: UpdatePriceDTO, context?: Context): Promise<PriceDTO[]>
  removePrices(priceIds: string[], context?: Context): Promise<void>
  listPrices(filters?: FilterablePriceProps, config?: FindConfig<PriceDTO>, context?: Context): Promise<PriceDTO[]>
  calculatePrices(
    priceSetIds: string[],
    pricingContext: PricingContext,
    context?: Context,
  ): Promise<CalculatedPriceSet[]>
}
