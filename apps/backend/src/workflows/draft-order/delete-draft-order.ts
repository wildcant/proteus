import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow } from '@core/workflows/types.js'

type DeleteDraftOrderInput = { orderId: string }

/**
 * Deletes a Draft Order made by mistake (Medusa's `deleteDraftOrdersWorkflow`), canceled or not, and
 * the link to the Cart it came from. The Cart stays closed: the shopper's storefront started a new
 * one when it was sent.
 *
 * Declares no errors of its own: the order module refuses an Order that was never a draft
 * (NOT_ALLOWED) and an unknown one (NOT_FOUND), which the route declares.
 */
export const deleteDraftOrderWorkflow = createWorkflow<DeleteDraftOrderInput, void>(
  { name: 'delete-draft-order', throws: [] },
  async (ctx, input) => {
    await ctx.step(
      'delete-draft-order',
      async ({ container }) => {
        await container.resolve(Modules.ORDER).deleteDraftOrder(input.orderId)
      },
      async (_output, { container }) => {
        await container.resolve(Modules.ORDER).restoreOrders([input.orderId])
      },
    )

    /** Last, and with nothing after it to fail: the draft it pointed at is already gone. */
    await ctx.step('dismiss-draft-order-links', async ({ container }) => {
      await container.resolve(ContainerRegistrationKeys.LINK).dismissLinks({ orderId: [input.orderId] })
    })
  },
)
