import { AppError, ErrorTypes } from '@core/errors/app-error.js'
import type { ReservationItemDTO } from '@core/types/inventory/common.js'
import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import type { OrderLineItemDTO } from '@core/types/order/common.js'
import { i18n } from '@proteus/utils'

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
        message: i18n.t('No reservation found for managed-inventory item {lineItemId}'),
        values: { lineItemId: lineItem.id },
      })
    }

    const requiredDeduction = lineItem.quantity * inventoryLink.requiredQuantity
    if (requiredDeduction > reservation.quantity) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: i18n.t('Reservation quantity ({quantity}) is insufficient for item {lineItemId}: requires {required}'),
        values: { quantity: reservation.quantity, lineItemId: lineItem.id, required: requiredDeduction },
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
