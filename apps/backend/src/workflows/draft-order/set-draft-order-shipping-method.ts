import { BigNumber } from '@core/bignumber.js'
import { ErrorTypes } from '@core/errors/app-error.js'
import { FulfillmentErrorCodes } from '@core/types/fulfillment/errors.js'
import type { OrderShippingMethodDTO } from '@core/types/order/common.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { loadDraftOrderShippingPricingContext } from './steps/refresh-draft-order-shipping-methods.js'

export type SetDraftOrderShippingMethodInput = {
  orderId: string
  shippingOptionId: string
  /**
   * What the shop agreed in the chat, in the draft's currency. Given, the method is stored at it and
   * marked custom, so re-pricing never overrides it; omitted, the option prices the draft.
   */
  customAmount?: string | undefined
  /** What the admin sends with the choice, which the option's provider validates when it prices. */
  data?: Record<string, unknown> | undefined
}

/** The method as priced, before it is written. Plain values, so it records the same on both engines. */
type PricedDraftShippingMethod = {
  name: string
  amount: string
  isTaxInclusive: boolean
  shippingOptionId: string
  data: Record<string, unknown>
  isCustomAmount: boolean
}

/**
 * Sets or replaces a draft's shipping method (Medusa's draft edit `addDraftOrderShippingMethods`,
 * with its custom amount).
 *
 * Without a custom amount the option is priced for the draft as it stands, as a Cart's is: it must
 * be enabled, serve the draft's address and, when calculated, be priced by its provider; the
 * provider's `validateFulfillmentData` answer is stored as the method's data. With one, the shop is
 * overriding the price — typically for a Cart that had no city, which no provider can price — so the
 * option is only read for its name.
 */
export const setDraftOrderShippingMethodWorkflow = createWorkflow<
  SetDraftOrderShippingMethodInput,
  OrderShippingMethodDTO
>({ name: 'set-draft-order-shipping-method', throws: [ErrorTypes.NOT_ALLOWED] }, async (ctx, input) => {
  const method = await ctx.step<PricedDraftShippingMethod>('price-draft-shipping-method', async ({ container }) => {
    const fulfillmentService = container.resolve(Modules.FULFILLMENT)
    const data = input.data ?? {}

    if (input.customAmount !== undefined) {
      const option = await fulfillmentService.retrieveShippingOption(input.shippingOptionId)
      return {
        name: option.name,
        amount: input.customAmount,
        isTaxInclusive: false,
        shippingOptionId: option.id,
        data,
        isCustomAmount: true,
      }
    }

    const pricingContext = await loadDraftOrderShippingPricingContext(container, input.orderId)
    const [quoted] = pricingContext
      ? await fulfillmentService.quoteShippingOptionsForContext([{ id: input.shippingOptionId, data }], pricingContext)
      : []
    if (!quoted) {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        code: FulfillmentErrorCodes.OPTION_UNAVAILABLE,
        message: i18n.t('Shipping option "{shippingOptionId}" is not available'),
        values: { shippingOptionId: input.shippingOptionId },
      })
    }

    return {
      name: quoted.name,
      amount: String(quoted.calculatedPrice.calculatedAmount),
      isTaxInclusive: quoted.calculatedPrice.isCalculatedPriceTaxInclusive,
      shippingOptionId: quoted.id,
      data: quoted.fulfillmentData,
      isCustomAmount: false,
    }
  })

  /** One replacement in one module, in one transaction, and the last step: nothing to put back. */
  return ctx.step('set-draft-shipping-method', async ({ container }) => {
    const { shippingMethod } = await container.resolve(Modules.ORDER).setDraftOrderShippingMethod(input.orderId, {
      ...method,
      amount: new BigNumber(method.amount),
    })
    return shippingMethod
  })
})
