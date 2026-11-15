import { ErrorTypes } from '@core/errors/app-error.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { type WorkflowContext, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { missingInventoryItemMessage, prepareLineItemInventoryChecks } from '../../cart/utils/variant-inventory.js'

/**
 * `INVALID_DATA` is this step's own: a tracked variant with no inventory item, or stocked nowhere.
 * The inventory module raises `NOT_ALLOWED` from `createReservationItems` when the shelf no longer
 * covers a line, which each workflow declares beside these.
 */
export const reserveOrderInventoryThrows = [ErrorTypes.INVALID_DATA] as const

/** What the step reserved, and the levels it moved, which the final step announces. */
export type OrderInventoryReservation = { reservationIds: string[]; levelIds: string[] }

/**
 * What `reserve-inventory` returns when it reserves nothing — an untracked basket, or one whose
 * line items name no variant. Named rather than written twice so both early returns and the
 * compensation agree on the shape.
 */
const EMPTY_RESERVATION: OrderInventoryReservation = { reservationIds: [], levelIds: [] }

/**
 * Reserves an Order's line items so the quantities can't be oversold between now and fulfillment,
 * and releases them if a later step fails. Shared by checkout and by converting a Draft Order: the
 * two moments an Order starts holding stock.
 */
export async function reserveOrderInventoryStep(
  ctx: WorkflowContext,
  input: { orderId: string },
): Promise<OrderInventoryReservation> {
  return ctx.step<OrderInventoryReservation>(
    'reserve-inventory',
    async ({ container }) => {
      const orderService = container.resolve(Modules.ORDER)
      const productService = container.resolve(Modules.PRODUCT)
      const inventoryService = container.resolve(Modules.INVENTORY)
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)

      /** The order's line items, not the cart's — which is why this step runs after the order
       *  exists. A reservation is read back by the line item it was taken for, and cancelling
       *  and fulfilling only ever hold the order's ids; keyed to the cart's, every reservation
       *  the shop holds would be unreachable. */
      const lineItems = await orderService.listOrderLineItems({ orderId: input.orderId })
      const variantIds = lineItems.map((item) => item.variantId).filter((id) => id != null)
      if (variantIds.length === 0) return EMPTY_RESERVATION

      /** An untracked variant is dropped before reservation and holds nothing, and a backorder
       *  variant reserves past what is on the shelf — so the flags are read here, before any
       *  row is written, rather than left to the inventory module to infer from a mapping. */
      const variants = await productService.listProductVariants({ id: variantIds })
      const mappings = await linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds)

      const missingInventoryItem = missingInventoryItemMessage(variants, mappings)
      if (missingInventoryItem) {
        throw new WorkflowTerminalError({ type: ErrorTypes.INVALID_DATA, ...missingInventoryItem })
      }

      const inventoryItemIds = [...new Set(mappings.map((mapping) => mapping.inventoryItemId))]
      const levels = await inventoryService.listInventoryLevels({ inventoryItemId: inventoryItemIds })

      const reservationInput = prepareLineItemInventoryChecks(lineItems, variants, mappings, levels).map((item) => {
        /** An item's available locations are the ones it has a level at, and the reservation is
         *  written against the first. Medusa ranks a wider candidate set; at one location every
         *  tier of that ranking selects the same element, so the ranking is not built.
         *
         *  None at all is a tracked variant with nowhere to draw stock from — bad data about the
         *  variant, not a shopper who arrived too late. Named here rather than left to the
         *  resolve below, which would only be able to report the empty id it was handed. */
        const locationId = item.locationIds[0]
        if (!locationId) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.INVALID_DATA,
            message: i18n.t(
              'Variant "{variantId}" is tracked, but its inventory item "{inventoryItemId}" is stocked at no location',
            ),
            values: { variantId: item.variantId, inventoryItemId: item.inventoryItemId },
          })
        }

        return {
          inventoryItemId: item.inventoryItemId,
          locationId,
          quantity: item.quantity * item.requiredQuantity,
          lineItemId: item.lineItemId,
          // Carried onto the row rather than re-read from the variant when the reservation is
          // released: the flag can be turned off while the order it was taken under is open.
          allowBackorder: item.allowBackorder,
        }
      })

      if (reservationInput.length === 0) return EMPTY_RESERVATION

      // `locationId` crosses a module boundary, so it carries no foreign key (ADR-0004).
      // Resolving before the write is what stands in for one: an id naming no Stock Location
      // fails here rather than silently at fulfillment, when the units are already sold.
      const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
      await stockLocationService.resolveStockLocations(reservationInput.map((item) => item.locationId))

      const reservations = await inventoryService.createReservationItems(reservationInput)

      /** The levels the reservations moved, carried out of the step so the final one can
       *  announce them. Ids only: the quantities are read at publish time, because a step's
       *  return value is what a retry replays rather than what the shelf holds. */
      const levelIds = [
        ...new Set(
          reservationInput.flatMap((item) =>
            levels
              .filter((level) => level.inventoryItemId === item.inventoryItemId && level.locationId === item.locationId)
              .map((level) => level.id),
          ),
        ),
      ]

      return { reservationIds: reservations.map((reservation) => reservation.id), levelIds }
    },
    async (result, { container }) => {
      if (!result || result.reservationIds.length === 0) return
      const inventoryService = container.resolve(Modules.INVENTORY)
      await inventoryService.softDeleteReservationItems(result.reservationIds)
    },
  )
}
