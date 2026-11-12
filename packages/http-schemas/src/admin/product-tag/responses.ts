import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminProductTag } from './entities.js'

export const AdminProductTagResponse = z.object({ tag: AdminProductTag }).openapi('AdminProductTagResponse')
export type AdminProductTagResponse = z.input<typeof AdminProductTagResponse>

export const AdminProductTagListResponse = PaginatedResponse.extend({
  tags: z.array(AdminProductTag),
}).openapi('AdminProductTagListResponse')
export type AdminProductTagListResponse = z.input<typeof AdminProductTagListResponse>
