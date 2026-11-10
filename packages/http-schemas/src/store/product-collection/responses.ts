import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { StoreProductCollection } from './entities.js'

export const StoreProductCollectionListResponse = PaginatedResponse.extend({
  collections: z.array(StoreProductCollection),
}).openapi('StoreProductCollectionListResponse')
export type StoreProductCollectionListResponse = z.input<typeof StoreProductCollectionListResponse>
