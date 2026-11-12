import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminProductCollection } from './entities.js'

export const AdminProductCollectionResponse = z
  .object({ collection: AdminProductCollection })
  .openapi('AdminProductCollectionResponse')
export type AdminProductCollectionResponse = z.input<typeof AdminProductCollectionResponse>

export const AdminProductCollectionListResponse = PaginatedResponse.extend({
  collections: z.array(AdminProductCollection),
}).openapi('AdminProductCollectionListResponse')
export type AdminProductCollectionListResponse = z.input<typeof AdminProductCollectionListResponse>
