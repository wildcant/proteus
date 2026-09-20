import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminReservationListParams, AdminReservationListResponse } from '@proteus/http-schemas/admin'

export const GetInput = { query: AdminReservationListParams }
export const GetOutput = AdminReservationListResponse

/**
 * Every reservation the shop is holding and the order behind each — the answer to "where did the
 * missing units go". A lens on inventory rather than a list of its own, and read-only: a
 * reservation is written by checkout and released by cancelling or fulfilling, never by hand.
 */
export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const inventoryService = req.scope.resolve<IInventoryModuleService>(Modules.INVENTORY)
  const orderService = req.scope.resolve<IOrderModuleService>(Modules.ORDER)
  const { pagination } = req.validatedQuery
  const { offset, limit } = pagination

  const [reservations, count] = await inventoryService.listAndCountReservationItems(undefined, {
    ...pagination,
    order: pagination.order ?? { createdAt: 'DESC' },
  })

  // The product, variant and sku come off the order's line item rather than the catalogue: they
  // are what was sold, and a rename since does not change which units are spoken for.
  const lineItemIds = reservations.map((reservation) => reservation.lineItemId).filter((id) => id !== null)
  const lineItems = lineItemIds.length ? await orderService.listOrderLineItems({ id: [...new Set(lineItemIds)] }) : []
  const lineItemById = new Map(lineItems.map((lineItem) => [lineItem.id, lineItem]))

  const orderIds = [...new Set(lineItems.map((lineItem) => lineItem.orderId))]
  const orders = orderIds.length ? await orderService.listOrders({ id: orderIds }) : []
  const displayIdByOrderId = new Map(orders.map((order) => [order.id, order.displayId]))

  const rows = reservations.map((reservation) => {
    const lineItem = reservation.lineItemId ? lineItemById.get(reservation.lineItemId) : undefined
    const orderId = lineItem?.orderId ?? null

    return {
      id: reservation.id,
      quantity: reservation.quantity,
      lineItemId: reservation.lineItemId,
      orderId,
      orderDisplayId: orderId ? (displayIdByOrderId.get(orderId) ?? null) : null,
      productTitle: lineItem?.productTitle ?? null,
      variantTitle: lineItem?.variantTitle ?? null,
      sku: lineItem?.variantSku ?? null,
      createdAt: reservation.createdAt,
    }
  })

  return { status: 200, json: { reservations: rows, count, offset, limit } }
}
