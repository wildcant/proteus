import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type {
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

  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    _context: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return {}
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
  ): Promise<{ amount: number }> {
    throw new AppError({ type: ErrorTypes.NOT_ALLOWED, message: 'Manual provider does not support calculated prices' })
  }

  async createFulfillment(_input: CreateProviderFulfillmentInput): Promise<{ data: Record<string, unknown> }> {
    return { data: {} }
  }

  async cancelFulfillment(_fulfillment: Record<string, unknown>): Promise<void> {
    // no-op for manual provider
  }
}
