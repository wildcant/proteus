import type { BigNumber } from '@core/bignumber.js'
import { ErrorTypes } from '@core/errors/app-error.js'
import type { OrderDTO } from '@core/types/order/common.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import {
  confirmLineItemsSellableStep,
  confirmLineItemsSellableThrows,
  type SellableLineItem,
} from '../cart/steps/confirm-line-items-sellable.js'
import { publishOrderPlacedStep } from '../order/steps/publish-order-placed.js'
import { reserveOrderInventoryStep, reserveOrderInventoryThrows } from '../order/steps/reserve-order-inventory.js'
import { recordOrderPaymentStep, recordOrderPaymentThrows } from '../payment/steps/record-order-payment.js'

export type ConvertDraftOrderInput = {
  orderId: string
  /** The deposit the shop received, recorded in the same run. Omitted, the draft converts unpaid. */
  paymentAmount?: BigNumber | undefined
}

/**
 * Medusa's `convertDraftOrderWorkflow`: the shop confirms a Draft Order, and it becomes a `pending`
 * Order that holds stock and has its payment collection.
 *
 * Every line is checked first, so a pair that sold out since the draft was made is refused by name
 * rather than by inventory item. Stock is then reserved, the draft becomes an Order, and only then
 * is the deposit recorded (a Proteus departure: Medusa converts and takes payment separately), so a
 * conversion that can't hold the stock takes no money, and a store that takes deposits holds stock
 * exactly once the deposit is in. `order.placed` goes out last, as from checkout.
 */
export const convertDraftOrderWorkflow = createWorkflow<ConvertDraftOrderInput, OrderDTO>(
  {
    name: 'convert-draft-order',
    throws: [
      ...confirmLineItemsSellableThrows,
      ...reserveOrderInventoryThrows,
      ...recordOrderPaymentThrows,
      ErrorTypes.INVALID_DATA,
      ErrorTypes.NOT_ALLOWED,
    ],
  },
  async (ctx, input) => {
    /** Only a draft still open converts: not one already converted, and not one the shop canceled. */
    const lineItems = await ctx.step<SellableLineItem[]>('validate-draft-order', async ({ container }) => {
      const orderService = container.resolve(Modules.ORDER)
      const order = await orderService.retrieveOrder(input.orderId)
      if (!order.isDraftOrder || order.status !== 'draft') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Order "{orderId}" is not an open draft order, so it cannot be converted'),
          values: { orderId: input.orderId },
        })
      }

      const lines = await orderService.listOrderLineItems({ orderId: input.orderId })
      if (lines.length === 0) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: i18n.t('Draft order "{orderId}" has no items'),
          values: { orderId: input.orderId },
        })
      }

      return lines.map(({ id, title, variantOptionValues, variantId, quantity }) => ({
        id,
        title,
        variantOptionValues,
        variantId,
        quantity,
      }))
    })

    await confirmLineItemsSellableStep(ctx, lineItems)

    const reserved = await reserveOrderInventoryStep(ctx, { orderId: input.orderId })

    const order = await ctx.step(
      'convert-draft-order',
      async ({ container }) => container.resolve(Modules.ORDER).convertDraftOrder(input.orderId),
      async (_order, { container }) => {
        await container.resolve(Modules.ORDER).updateOrder(input.orderId, { status: 'draft', isDraftOrder: true })
      },
    )

    /** Opens the Order's payment collection for its total, and captures the deposit against it when
     *  one was given. After the conversion, because a payment is recorded on an Order, not a draft. */
    await recordOrderPaymentStep(ctx, { orderId: input.orderId, amount: input.paymentAmount })

    await publishOrderPlacedStep(ctx, { orderId: input.orderId, levelIds: reserved.levelIds })

    return order
  },
)
