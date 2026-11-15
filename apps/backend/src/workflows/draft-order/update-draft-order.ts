import type { OrderAddressDTO } from '@core/types/order/common.js'
import type { UpdateDraftOrderDTO } from '@core/types/order/mutations.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow } from '@core/workflows/types.js'
import { refreshDraftOrderShippingMethodsStep } from './steps/refresh-draft-order-shipping-methods.js'

export type UpdateDraftOrderInput = UpdateDraftOrderDTO & { orderId: string }

/** The draft as it was before the edit, for the compensation to put back. */
type PreviousDraftDetails = {
  email: string | null
  shippingAddress: OrderAddressDTO | null
}

/**
 * What the shop records on a draft after the chat (Medusa's `updateDraftOrderWorkflow`): the
 * shopper's email, and the shipping address with the phone the shopper gave. The address is merged
 * into the draft's, so sending the phone alone keeps the city. A calculated shipping method is then
 * re-priced for the address, unless the shop set its amount by hand.
 *
 * Declares no errors of its own: the order module refuses an Order that is not an open draft
 * (NOT_ALLOWED) and an unknown one (NOT_FOUND), which the route declares.
 */
export const updateDraftOrderWorkflow = createWorkflow<UpdateDraftOrderInput, void>(
  { name: 'update-draft-order', throws: [] },
  async (ctx, input) => {
    await ctx.step<PreviousDraftDetails>(
      'update-draft-order',
      async ({ container }) => {
        const orderService = container.resolve(Modules.ORDER)
        const [order, shippingAddress] = await Promise.all([
          orderService.retrieveOrder(input.orderId),
          orderService.retrieveOrderAddress(input.orderId, 'shipping'),
        ])
        await orderService.updateDraftOrder(input.orderId, {
          email: input.email,
          shippingAddress: input.shippingAddress,
        })
        return { email: order.email, shippingAddress }
      },
      async (previous, { container }) => {
        const orderService = container.resolve(Modules.ORDER)
        await orderService.updateOrder(input.orderId, { email: previous.email })
        if (previous.shippingAddress) {
          const { id, orderId, type, createdAt, updatedAt, deletedAt, ...fields } = previous.shippingAddress
          await orderService.upsertOrderAddress(input.orderId, 'shipping', fields)
          return
        }
        // The edit created the address, so putting the draft back removes it.
        const created = await orderService.retrieveOrderAddress(input.orderId, 'shipping')
        if (created) await orderService.softDeleteOrderAddresses([created.id])
      },
    )

    await refreshDraftOrderShippingMethodsStep(ctx, { orderId: input.orderId })
  },
)
