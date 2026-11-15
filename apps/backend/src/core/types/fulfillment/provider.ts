import type { BigNumber } from '../../bignumber.js'

export type FulfillmentOption = {
  id: string
  isReturn?: boolean
}

/**
 * Where a shipment goes, as far as pricing it needs to know. Only the country is required: a cart
 * that has not reached the address step is priced for its region's country, and a provider that
 * needs a city answers "can't calculate" for an address without one.
 */
type ShippingPricingAddress = {
  countryCode: string
  province?: string | null | undefined
  city?: string | null | undefined
  postalCode?: string | null | undefined
  address1?: string | null | undefined
  address2?: string | null | undefined
  company?: string | null | undefined
  firstName?: string | null | undefined
  lastName?: string | null | undefined
  phone?: string | null | undefined
}

/** The physical facts of a line's variant a courier prices by. Null when the line has no variant. */
type ShippingPricingVariant = {
  id: string
  weight: number | null
  length: number | null
  height: number | null
  width: number | null
}

type ShippingPricingItem = {
  id: string
  title: string
  quantity: number
  unitPrice: BigNumber
  variantId: string | null
  variant: ShippingPricingVariant | null
}

/**
 * What a calculated shipping price is computed from, Medusa's `CalculateShippingOptionPriceContext`:
 * the shipping address, the items with their variants' weight and dimensions, and the currency the
 * amount is in.
 *
 * Plain data rather than a cart, so the same context can price an Order draft's shipping after its
 * Cart has closed. `cartId` is there for a provider that keys a quote by it, and is absent then.
 */
export type CalculateShippingPriceContext = {
  cartId?: string | null | undefined
  currencyCode: string
  shippingAddress: ShippingPricingAddress
  items: ShippingPricingItem[]
}

/** A provider's answer, Medusa's `CalculatedShippingOptionPrice`. The amount is in the context's currency. */
export type CalculatedShippingPrice = {
  calculatedAmount: number
  isCalculatedPriceTaxInclusive: boolean
}

export type CreateProviderFulfillmentInput = {
  data?: Record<string, unknown>
  items: { title: string; quantity: number; sku?: string | null; barcode?: string | null }[]
  fulfillment?: Record<string, unknown>
}

export type IFulfillmentProvider = {
  getIdentifier(): string
  getFulfillmentOptions(): Promise<FulfillmentOption[]>
  /**
   * Checks the data a shipping method is set with and answers what the method stores in its `data`
   * — what the price was based on, a delivery estimate. The context is the one the price is
   * calculated from.
   */
  validateFulfillmentData(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: CalculateShippingPriceContext,
  ): Promise<Record<string, unknown>>
  validateOption(data: Record<string, unknown>): Promise<boolean>
  canCalculate(data: Record<string, unknown>): Promise<boolean>
  /**
   * Prices an option for the context. A provider that cannot price this address or these items
   * throws `cannotCalculateShippingPrice(…)`, and the option is left out of what the shopper is
   * offered rather than failing the listing.
   */
  calculatePrice(
    optionData: Record<string, unknown>,
    data: Record<string, unknown>,
    context: CalculateShippingPriceContext,
  ): Promise<CalculatedShippingPrice>
  createFulfillment(input: CreateProviderFulfillmentInput): Promise<{ data: Record<string, unknown> }>
  cancelFulfillment(fulfillment: Record<string, unknown>): Promise<void>
}
