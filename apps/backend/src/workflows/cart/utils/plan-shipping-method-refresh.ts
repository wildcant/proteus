import { BigNumber } from '@core/bignumber.js'
import type { QuotedShippingOptionDTO, ShippingOptionToPrice } from '@core/types/fulfillment/service.js'

/** The part of a stored shipping method, a Cart's or a Draft Order's, that a refresh re-states. */
export type RefreshableShippingMethod = {
  id: string
  shippingOptionId: string | null
  amount: BigNumber
  isTaxInclusive: boolean
  data: Record<string, unknown> | null
}

/** A method's price and the provider's data it was based on, as a refresh writes them. */
type ShippingMethodRequote = Omit<RefreshableShippingMethod, 'shippingOptionId'>

/** What a refresh changed, so its compensation can put each method back as it was. */
export type ShippingMethodRefreshUndo = {
  previous: ShippingMethodRequote[]
  removedIds: string[]
}

export type ShippingMethodRefreshPlan = ShippingMethodRefreshUndo & { update: ShippingMethodRequote[] }

/**
 * What to ask the fulfillment module to quote again: each method's option, with the data the
 * method stored, which its provider validates once more. A method with no option behind it has
 * nothing to quote.
 */
export function shippingMethodsToQuote(methods: RefreshableShippingMethod[]): ShippingOptionToPrice[] {
  return methods.flatMap((method) =>
    method.shippingOptionId ? [{ id: method.shippingOptionId, data: method.data }] : [],
  )
}

/**
 * Medusa's refresh rule, shared by a Cart's and a Draft Order's shipping: a method whose option was
 * quoted again takes the new price and the provider's new data together, so a delivery estimate
 * follows the address the price did; one whose option was not quoted (disabled, no longer serving
 * the address, or no longer priced there) is removed, as is one with no option behind it.
 */
export function planShippingMethodRefresh(
  methods: RefreshableShippingMethod[],
  quotes: QuotedShippingOptionDTO[],
): ShippingMethodRefreshPlan {
  const quoteByOptionId = new Map(quotes.map((quote) => [quote.id, quote]))
  const plan: ShippingMethodRefreshPlan = { update: [], previous: [], removedIds: [] }

  for (const method of methods) {
    const quote = method.shippingOptionId ? quoteByOptionId.get(method.shippingOptionId) : undefined
    if (!quote) {
      plan.removedIds.push(method.id)
      continue
    }
    plan.update.push({
      id: method.id,
      amount: new BigNumber(quote.calculatedPrice.calculatedAmount),
      isTaxInclusive: quote.calculatedPrice.isCalculatedPriceTaxInclusive,
      data: quote.fulfillmentData,
    })
    plan.previous.push({
      id: method.id,
      amount: method.amount,
      isTaxInclusive: method.isTaxInclusive,
      data: method.data,
    })
  }

  return plan
}
