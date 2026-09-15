import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

/**
 * `lowStock` narrows the list to what is at or below the store's low-stock threshold, so
 * reordering is a short list rather than a scan. A store with no threshold set has nothing to
 * compare against and the filter returns nothing rather than erroring.
 */
export const AdminInventoryItemListParams = createFindParams().extend({
  lowStock: z.union([z.boolean(), z.string().transform((v) => v === 'true')]).optional(),
})
export type AdminInventoryItemListQuery = FindParams<typeof AdminInventoryItemListParams>

export const AdminReservationListParams = createFindParams()
export type AdminReservationListQuery = FindParams<typeof AdminReservationListParams>
