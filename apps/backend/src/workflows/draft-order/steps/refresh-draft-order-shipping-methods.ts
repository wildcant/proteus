import { BigNumber } from '@core/bignumber.js'
import type { AppContainer } from '@core/types/container.js'
import type { CalculateShippingPriceContext } from '@core/types/fulfillment/provider.js'
import type { OrderShippingMethodPriceUpdateDTO } from '@core/types/order/mutations.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { WorkflowContext } from '@core/workflows/types.js'
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

/** What a refresh changed, so its compensation can put each method back as it was. */
type DraftShippingRefreshResult = {
  previousPrices: OrderShippingMethodPriceUpdateDTO[]
  removedIds: string[]
}

/**
 * The Cart's shipping refresh (Medusa's `refreshCartShippingMethodsWorkflow`), for a Draft Order:
 * the last step of every edit that changes what a shipping price depends on — its items and its
 * shipping address.
 *
 * Each method is re-priced for the draft as it now stands, a calculated one by its provider and a
 * flat one at its option's current amount, and a method whose option no longer serves the address,
 * is disabled or can't be priced there is removed, leaving the admin to set one again. A method
 * the admin set a custom amount on is left exactly as it is: that amount is what the shop agreed in
 * the chat, and no price list overrides it.
 */
export async function refreshDraftOrderShippingMethodsStep(
  ctx: WorkflowContext,
  input: { orderId: string },
): Promise<DraftShippingRefreshResult> {
  return ctx.step<DraftShippingRefreshResult>(
    'refresh-draft-order-shipping-methods',
    async ({ container }) => {
      const orderService = container.resolve(Modules.ORDER)
      const shippingMethods = (await orderService.listOrderShippingMethods({ orderId: input.orderId })).filter(
        (method) => !method.isCustomAmount,
      )
      if (shippingMethods.length === 0) return { previousPrices: [], removedIds: [] }

      const pricingContext = await loadDraftOrderShippingPricingContext(container, input.orderId)
      const priced = pricingContext
        ? await container.resolve(Modules.FULFILLMENT).priceShippingOptionsForContext(
            shippingMethods.flatMap((method) =>
              method.shippingOptionId ? [{ id: method.shippingOptionId, data: method.data }] : [],
            ),
            pricingContext,
          )
        : []
      const priceByOptionId = new Map(priced.map((option) => [option.id, option.calculatedPrice]))

      const update: OrderShippingMethodPriceUpdateDTO[] = []
      const previousPrices: OrderShippingMethodPriceUpdateDTO[] = []
      const removedIds: string[] = []
      for (const method of shippingMethods) {
        const price = method.shippingOptionId ? priceByOptionId.get(method.shippingOptionId) : undefined
        if (!price) {
          removedIds.push(method.id)
          continue
        }
        update.push({ id: method.id, amount: new BigNumber(price.calculatedAmount) })
        previousPrices.push({ id: method.id, amount: method.amount })
      }

      await orderService.applyOrderShippingMethodRefresh({ update, remove: removedIds })
      return { previousPrices, removedIds }
    },
    async ({ previousPrices, removedIds }, { container }) => {
      if (previousPrices.length === 0 && removedIds.length === 0) return
      const orderService = container.resolve(Modules.ORDER)
      await orderService.applyOrderShippingMethodRefresh({ update: previousPrices, remove: [] })
      if (removedIds.length > 0) await orderService.restoreOrderShippingMethods(removedIds)
    },
  )
}
