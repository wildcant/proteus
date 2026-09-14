import { z } from 'zod'
import { dateToIso } from '../../common.js'

/**
 * One tracked variant's stock, as the shopkeeper scans it: what is on the shelf, what orders
 * have already spoken for, and what is left to sell.
 *
 * Stocked and Reserved ride as separate numbers rather than one total on purpose — units
 * committed to an order are not units a shopkeeper can reorder against. `availableQuantity` is
 * their difference, computed server-side so the list and the variant page cannot disagree.
 */
export const AdminInventoryItem = z
  .object({
    /** The Inventory Item behind the variant. There is no detail page for it; the variant is one. */
    id: z.string(),
    sku: z.string().nullable(),
    productId: z.string(),
    productTitle: z.string(),
    variantId: z.string(),
    variantTitle: z.string().nullable(),
    stockedQuantity: z.number(),
    reservedQuantity: z.number(),
    availableQuantity: z.number(),
    /**
     * Whether the shopkeeper should reorder this one — the store's threshold applied server-side,
     * per ADR-0015, so the list renders an answer rather than thresholding a number itself. A
     * store that has set no threshold has nothing running low.
     */
    lowStock: z.boolean(),
  })
  .openapi('AdminInventoryItem')
export type AdminInventoryItem = z.input<typeof AdminInventoryItem>

/**
 * One reservation the shop is holding, with the order it belongs to.
 *
 * The product, variant and sku are the order line item's own copy of them, which is what the
 * shopkeeper is explaining when they ask where the missing units went — the catalogue may have
 * been renamed since the order was placed.
 */
export const AdminReservation = z
  .object({
    id: z.string(),
    quantity: z.number(),
    lineItemId: z.string().nullable(),
    /** Null when the line item behind the reservation is gone, which leaves the row unlinkable. */
    orderId: z.string().nullable(),
    orderDisplayId: z.number().nullable(),
    productTitle: z.string().nullable(),
    variantTitle: z.string().nullable(),
    sku: z.string().nullable(),
    createdAt: dateToIso,
  })
  .openapi('AdminReservation')
export type AdminReservation = z.input<typeof AdminReservation>
