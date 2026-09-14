import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminInventoryItem, AdminReservation } from './entities.js'

export const AdminInventoryItemListResponse = PaginatedResponse.extend({
  inventoryItems: z.array(AdminInventoryItem),
}).openapi('AdminInventoryItemListResponse')
export type AdminInventoryItemListResponse = z.input<typeof AdminInventoryItemListResponse>

export const AdminReservationListResponse = PaginatedResponse.extend({
  reservations: z.array(AdminReservation),
}).openapi('AdminReservationListResponse')
export type AdminReservationListResponse = z.input<typeof AdminReservationListResponse>
