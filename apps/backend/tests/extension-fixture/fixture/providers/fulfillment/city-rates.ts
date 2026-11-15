import type { ExtensionProviderDependencies } from '@core/extensions/extension.js'
import { cannotCalculateShippingPrice } from '@core/types/fulfillment/errors.js'
import type {
  CalculatedShippingPrice,
  CalculateShippingPriceContext,
  CreateProviderFulfillmentInput,
  FulfillmentOption,
} from '@core/types/fulfillment/provider.js'
import { AbstractFulfillmentProvider } from '@core/utils/abstract-fulfillment-provider.js'
import { ModuleProvider } from '@core/utils/module-provider.js'
import { Modules } from '@core/utils/modules-definition.js'
import { i18n } from '@proteus/utils'
import { FixtureModules } from '../../keys.js'
import type { FixtureShippingRateDTO, IFixtureShippingRatesService } from '../../types/shipping-rates.js'

/**
 * A courier that prices by the destination city from the fixture's own rate table: the rate's base
 * amount plus its per-item amount for every unit in the parcel. It stands in for a fork's courier,
 * so the suite covers an extension provider that depends on its extension's module.
 *
 * Registered as `fp_fixture_city_rates_default`; the identifier carries the extension's snake
 * prefix, which `extensions:generate` checks.
 */
class FixtureCityRatesProvider extends AbstractFulfillmentProvider {
  static identifier = 'fixture_city_rates'

  private shippingRates: IFixtureShippingRatesService

  constructor({ resolve }: ExtensionProviderDependencies) {
    super({}, {})
    this.shippingRates = resolve(FixtureModules.SHIPPING_RATES)
  }

  async getFulfillmentOptions(): Promise<FulfillmentOption[]> {
    return [{ id: 'city-rates' }]
  }

  async validateOption(_data: Record<string, unknown>): Promise<boolean> {
    return true
  }

  async canCalculate(_data: Record<string, unknown>): Promise<boolean> {
    return true
  }

  async calculatePrice(
    _optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: CalculateShippingPriceContext,
  ): Promise<CalculatedShippingPrice> {
    const rate = await this.rateFor(context)
    const units = context.items.reduce((sum, item) => sum + item.quantity, 0)
    return { calculatedAmount: rate.baseAmount + rate.perItemAmount * units, isCalculatedPriceTaxInclusive: false }
  }

  /** What the price was based on, kept on the shipping method. */
  async validateFulfillmentData(
    _optionData: Record<string, unknown>,
    _data: Record<string, unknown>,
    context: CalculateShippingPriceContext,
  ): Promise<Record<string, unknown>> {
    const rate = await this.rateFor(context)
    return { deliveryDays: rate.deliveryDays }
  }

  async createFulfillment(_input: CreateProviderFulfillmentInput): Promise<{ data: Record<string, unknown> }> {
    return { data: {} }
  }

  async cancelFulfillment(_fulfillment: Record<string, unknown>): Promise<void> {
    // Nothing was booked with a courier, so there is nothing to cancel.
  }

  private async rateFor(context: CalculateShippingPriceContext): Promise<FixtureShippingRateDTO> {
    const city = context.shippingAddress.city
    const rate = city ? await this.shippingRates.findRateForCity(city) : null
    if (!rate) {
      throw cannotCalculateShippingPrice(i18n.t('The fixture courier has no rate for "{city}"'), { city: city ?? '' })
    }
    return rate
  }
}

export default ModuleProvider(Modules.FULFILLMENT, { services: [FixtureCityRatesProvider] })
