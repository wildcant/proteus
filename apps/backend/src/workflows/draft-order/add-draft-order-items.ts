import { ErrorTypes } from '@core/errors/app-error.js'
import type { DraftOrderLineItemsAddition } from '@core/types/order/mutations.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { confirmVariantInventoryStep, confirmVariantInventoryThrows } from '../cart/steps/confirm-variant-inventory.js'
import { prepareLineItemsStep, prepareLineItemsThrows } from '../cart/steps/prepare-line-items.js'
import type { VariantDemand } from '../cart/utils/variant-inventory.js'
import { refreshDraftOrderShippingMethodsStep } from './steps/refresh-draft-order-shipping-methods.js'

export type AddDraftOrderItemsInput = {
  orderId: string
  items: { variantId: string; quantity: number }[]
}

/**
 * Adds variants to a Draft Order (Medusa's draft edit `addDraftOrderItems`), each merged into the
 * line the draft already holds for it.
 *
 * Priced in the draft's currency — the one its region was priced in when it was a Cart — through
 * the same line building as add-to-cart, so an added pair is titled and priced as the shopper's own
 * were. Stock is confirmed for the quantity each line ends up at, without reserving: the draft
 * still reserves nothing until it converts. A calculated shipping method is then re-priced.
 */
export const addDraftOrderItemsWorkflow = createWorkflow<AddDraftOrderItemsInput, DraftOrderLineItemsAddition>(
  {
    name: 'add-draft-order-items',
    throws: [...prepareLineItemsThrows, ...confirmVariantInventoryThrows, ErrorTypes.NOT_ALLOWED],
  },
  async (ctx, input) => {
    /** The currency to price in, and what each variant's line will hold once the addition lands. */
    const draft = await ctx.step('plan-draft-order-items', async ({ container }) => {
      const orderService = container.resolve(Modules.ORDER)
      const order = await orderService.retrieveOrder(input.orderId)
      if (!order.isDraftOrder || order.status !== 'draft') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Order "{orderId}" is not an open draft order, so its items cannot be changed'),
          values: { orderId: input.orderId },
        })
      }

      const existing = await orderService.listOrderLineItems({ orderId: input.orderId })
      const quantityByVariantId = new Map<string, number>()
      for (const line of existing) {
        if (line.variantId) quantityByVariantId.set(line.variantId, line.quantity)
      }
      for (const item of input.items) {
        quantityByVariantId.set(item.variantId, (quantityByVariantId.get(item.variantId) ?? 0) + item.quantity)
      }
      const demands: VariantDemand[] = input.items.map((item) => ({
        variantId: item.variantId,
        quantity: quantityByVariantId.get(item.variantId) ?? item.quantity,
      }))

      return { currencyCode: order.currencyCode, demands }
    })

    const lineItems = await prepareLineItemsStep(ctx, { currencyCode: draft.currencyCode, items: input.items })

    await confirmVariantInventoryStep(ctx, draft.demands)

    const added = await ctx.step<DraftOrderLineItemsAddition>(
      'write-draft-order-items',
      async ({ container }) =>
        container.resolve(Modules.ORDER).addDraftOrderLineItems(
          input.orderId,
          lineItems.map((item) => ({
            title: item.title,
            subtitle: item.subtitle,
            thumbnail: item.thumbnail,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            compareAtUnitPrice: item.compareAtUnitPrice,
            variantId: item.variantId,
            productId: item.productId,
            productTitle: item.productTitle,
            productDescription: item.productDescription,
            productSubtitle: item.productSubtitle,
            productType: item.productType,
            productHandle: item.productHandle,
            variantSku: item.variantSku,
            variantBarcode: item.variantBarcode,
            variantTitle: item.variantTitle,
            variantOptionValues: item.variantOptionValues,
            variantOptions: item.variantOptions,
            requiresShipping: item.requiresShipping,
          })),
        ),
      async ({ createdIds, previousQuantities }, { container }) => {
        const orderService = container.resolve(Modules.ORDER)
        if (createdIds.length > 0) await orderService.softDeleteOrderLineItems(createdIds)
        if (previousQuantities.length > 0) await orderService.updateOrderLineItemQuantities(previousQuantities)
      },
    )

    await refreshDraftOrderShippingMethodsStep(ctx, { orderId: input.orderId })

    return added
  },
)
