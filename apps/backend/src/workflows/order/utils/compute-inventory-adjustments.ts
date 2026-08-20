import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ReservationItemDTO } from '@core/types/inventory/common.js'
import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import type { OrderLineItemDTO } from '@core/types/order/common.js'

export type InventoryAdjustment = { inventoryItemId: string; locationId: string; quantity: number }

export function computeInventoryAdjustments(
  lineItems: OrderLineItemDTO[],
  variantInventoryMap: Map<string, ProductVariantInventoryItemDTO>,
  reservationsByLineItem: Map<string, ReservationItemDTO>,
): { adjustments: InventoryAdjustment[]; reservationIdsToDelete: string[] } {
  const adjustments: InventoryAdjustment[] = []
  const reservationIdsToDelete: string[] = []

  for (const lineItem of lineItems) {
    const inventoryLink = lineItem.variantId ? variantInventoryMap.get(lineItem.variantId) : undefined
    const reservation = reservationsByLineItem.get(lineItem.id)

    if (!inventoryLink) {
      if (reservation) {
        adjustments.push({
          inventoryItemId: reservation.inventoryItemId,
          locationId: reservation.locationId,
          quantity: -reservation.quantity,
        })
        reservationIdsToDelete.push(reservation.id)
      }
      continue
    }

    if (!reservation) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `No reservation found for managed-inventory item ${lineItem.id}`,
      })
    }

    const requiredDeduction = lineItem.quantity * inventoryLink.requiredQuantity
    if (requiredDeduction > reservation.quantity) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Reservation quantity (${reservation.quantity}) is insufficient for item ${lineItem.id}: requires ${requiredDeduction}`,
      })
    }

    adjustments.push({
      inventoryItemId: inventoryLink.inventoryItemId,
      locationId: reservation.locationId,
      quantity: -requiredDeduction,
    })
    reservationIdsToDelete.push(reservation.id)
  }

  return { adjustments, reservationIdsToDelete }
}
