import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminRegion } from './entities.js'

export const AdminRegionResponse = z.object({ region: AdminRegion }).openapi('AdminRegionResponse')
export type AdminRegionResponse = z.input<typeof AdminRegionResponse>

export const AdminRegionListResponse = PaginatedResponse.extend({
  regions: z.array(AdminRegion),
}).openapi('AdminRegionListResponse')
export type AdminRegionListResponse = z.input<typeof AdminRegionListResponse>
