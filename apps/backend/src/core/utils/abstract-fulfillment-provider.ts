import type {
  CalculatedShippingPrice,
  CalculateShippingPriceContext,
  CreateProviderFulfillmentInput,
  FulfillmentOption,
  IFulfillmentProvider,
} from '../types/fulfillment/provider.js'

export abstract class AbstractFulfillmentProvider<TConfig = Record<string, unknown>> implements IFulfillmentProvider {
  static identifier: string

  protected config: TConfig
  protected container: Record<string, unknown>

  constructor(container: Record<string, unknown>, config: TConfig) {
    this.container = container
    this.config = config
  }

  getIdentifier(): string {
    const ctr = this.constructor as typeof AbstractFulfillmentProvider

    if (!ctr.identifier) {
      throw new Error('Missing static property "identifier".')
    }

    return ctr.identifier
  }

  abstract getFulfillmentOptions(): Promise<FulfillmentOption[]>

  abstract validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: CalculateShippingPriceContext,
  ): Promise<Record<string, unknown>>

  abstract validateOption(data: Record<string, unknown>): Promise<boolean>

  abstract canCalculate(data: Record<string, unknown>): Promise<boolean>

  abstract calculatePrice(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: CalculateShippingPriceContext,
  ): Promise<CalculatedShippingPrice>

  abstract createFulfillment(input: CreateProviderFulfillmentInput): Promise<{ data: Record<string, unknown> }>

  abstract cancelFulfillment(fulfillment: Record<string, unknown>): Promise<void>
}
