import type { AppContainer } from '@core/types/container.js'
import type { CalculateShippingPriceContext } from '@core/types/fulfillment/provider.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { WorkflowContext } from '@core/workflows/types.js'
import {
  planShippingMethodRefresh,
  type ShippingMethodRefreshUndo,
  shippingMethodsToQuote,
} from '../../cart/utils/plan-shipping-method-refresh.js'
import { buildShippingPricingContext } from '../../cart/utils/shipping-pricing-context.js'

/**
 * What a Draft Order's shipping is priced from, the way a Cart's is: its shipping address (or its
 * region's first country before one is entered), its lines and their variants, in its currency.
 * The draft carries the region it was priced in, so this still works after its Cart has closed.
 * Null when there is no country to ship to. Reads only; it runs inside a step action.
 */
export async function loadDraftOrderShippingPricingContext(
  container: AppContainer,
  orderId: string,
): Promise<CalculateShippingPriceContext | null> {
  const orderService = container.resolve(Modules.ORDER)
  const [order, shippingAddress, lineItems] = await Promise.all([
    orderService.retrieveOrder(orderId),
    orderService.retrieveOrderAddress(orderId, 'shipping'),
    orderService.listOrderLineItems({ orderId }),
  ])

  const variantIds = [...new Set(lineItems.flatMap((item) => (item.variantId ? [item.variantId] : [])))]
  const [variants, regionCountries] = await Promise.all([
    variantIds.length > 0 ? container.resolve(Modules.PRODUCT).listProductVariants({ id: variantIds }) : [],
    !shippingAddress?.countryCode && order.regionId
      ? container
          .resolve(Modules.REGION)
          .listCountries({ regionId: order.regionId }, { order: { id: 'ASC' }, limit: 1 })
      : [],
  ])

  return buildShippingPricingContext({
    cartId: null,
    currencyCode: order.currencyCode,
    shippingAddress,
    regionCountryCode: regionCountries[0]?.id ?? null,
    lineItems,
    variants,
  })
}

/**
 * The Cart's shipping refresh (Medusa's `refreshCartShippingMethodsWorkflow`), for a Draft Order:
 * the last step of every edit that changes what a shipping price depends on — its items and its
 * shipping address.
 *
 * Each method is quoted again for the draft as it now stands, by the same rule as a Cart's
 * (`planShippingMethodRefresh`): the new price and the provider's new data together, or the method
 * removed when it can no longer be quoted, leaving the admin to set one again.
 *
 * A method the admin set a custom amount on is left exactly as it is, data included. Its amount is
 * what the shop agreed with the shopper, and its data was never the provider's answer to begin
 * with: the admin sets one typically because no provider can price the address, so asking the
 * provider again would remove the method rather than refresh it.
 */
export async function refreshDraftOrderShippingMethodsStep(
  ctx: WorkflowContext,
  input: { orderId: string },
): Promise<ShippingMethodRefreshUndo> {
  return ctx.step<ShippingMethodRefreshUndo>(
    'refresh-draft-order-shipping-methods',
    async ({ container }) => {
      const orderService = container.resolve(Modules.ORDER)
      const shippingMethods = (await orderService.listOrderShippingMethods({ orderId: input.orderId })).filter(
        (method) => !method.isCustomAmount,
      )
      if (shippingMethods.length === 0) return { previous: [], removedIds: [] }

      const pricingContext = await loadDraftOrderShippingPricingContext(container, input.orderId)
      const quotes = pricingContext
        ? await container
            .resolve(Modules.FULFILLMENT)
            .quoteShippingOptionsForContext(shippingMethodsToQuote(shippingMethods), pricingContext)
        : []
      const { update, previous, removedIds } = planShippingMethodRefresh(shippingMethods, quotes)

      await orderService.applyOrderShippingMethodRefresh({ update, remove: removedIds })
      return { previous, removedIds }
    },
    async ({ previous, removedIds }, { container }) => {
      if (previous.length === 0 && removedIds.length === 0) return
      const orderService = container.resolve(Modules.ORDER)
      await orderService.applyOrderShippingMethodRefresh({ update: previous, remove: [] })
      if (removedIds.length > 0) await orderService.restoreOrderShippingMethods(removedIds)
    },
  )
}
