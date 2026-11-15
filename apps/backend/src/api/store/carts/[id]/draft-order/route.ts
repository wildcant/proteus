import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { IdParams, StoreCreateDraftOrderResponse } from '@proteus/http-schemas/store'
import { i18n } from '@proteus/utils'
import { createDraftOrderFromCartWorkflow } from '@workflows/draft-order/create-draft-order-from-cart.js'
import { orderReference } from '@workflows/order/utils/order-reference.js'

export const PostInput = { params: IdParams }
export const PostOutput = StoreCreateDraftOrderResponse
export const PostThrows = [...createDraftOrderFromCartWorkflow.throws, ErrorTypes.NOT_FOUND] as const

/**
 * A Proteus addition: the shopper sends the Cart to the shop as a Draft Order, closing it. Opt-in
 * through the store settings, and answered as an unknown route when the store sells by card only,
 * so such a store exposes nothing new. Sending the same Cart again answers the same draft.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE)
  if (!config.projectConfig.store.draftOrders) {
    throw new AppError({
      type: ErrorTypes.NOT_FOUND,
      message: i18n.t('This store does not take draft orders'),
    })
  }

  const order = await createDraftOrderFromCartWorkflow.run({ cartId: req.params.id })

  return { status: 200, json: { orderId: order.id, reference: orderReference(order.displayId) } }
}
