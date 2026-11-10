import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminProductType } from './entities.js'

export const AdminProductTypeResponse = z.object({ type: AdminProductType }).openapi('AdminProductTypeResponse')
export type AdminProductTypeResponse = z.input<typeof AdminProductTypeResponse>

export const AdminProductTypeListResponse = PaginatedResponse.extend({
  types: z.array(AdminProductType),
}).openapi('AdminProductTypeListResponse')
export type AdminProductTypeListResponse = z.input<typeof AdminProductTypeListResponse>
