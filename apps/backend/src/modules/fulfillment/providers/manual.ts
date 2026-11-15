import { i18n } from '@proteus/utils'
import { cannotCalculateShippingPrice } from '../../../core/types/fulfillment/errors.js'
import type {
  CalculatedShippingPrice,
  CalculateShippingPriceContext,
  CreateProviderFulfillmentInput,
  FulfillmentOption,
} from '../../../core/types/fulfillment/provider.js'
import { AbstractFulfillmentProvider } from '../../../core/utils/abstract-fulfillment-provider.js'

export class ManualFulfillmentProvider extends AbstractFulfillmentProvider {
  static identifier = 'manual'

  constructor() {
    super({}, {} as Record<string, unknown>)
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: 'manual-fulfillment' }]
  }

  /** Accepts what the shopper sent as it is, as Medusa's manual provider does: it is what the method stores. */
  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    _context: CalculateShippingPriceContext,
  ): Promise<Record<string, unknown>> {
    return data
  }

  async validateOption(_data: Record<string, unknown>): Promise<boolean> {
    return true
  }

  async canCalculate(_data: Record<string, unknown>): Promise<boolean> {
    return false
  }

  async calculatePrice(
    _optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    _context: CalculateShippingPriceContext,
  ): Promise<CalculatedShippingPrice> {
    throw cannotCalculateShippingPrice(i18n.t('Manual provider does not support calculated prices'))
  }

  async createFulfillment(_input: CreateProviderFulfillmentInput): Promise<{ data: Record<string, unknown> }> {
    return { data: {} }
  }

  async cancelFulfillment(_fulfillment: Record<string, unknown>): Promise<void> {
    // no-op for manual provider
  }
}
