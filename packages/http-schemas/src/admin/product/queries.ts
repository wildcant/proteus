import { z } from 'zod'
import { createDateOperatorMap, createFindParams, type FindParams } from '../../common.js'
import { ProductStatus } from './entities.js'

export const AdminProductListParams = createFindParams().extend({
  q: z.string().optional(),
  status: z.union([ProductStatus, ProductStatus.array()]).optional(),
  createdAt: createDateOperatorMap().optional(),
  /** Direct members of the Category only — a product in one of its children is not listed. */
  categoryId: z.union([z.string(), z.string().array()]).optional(),
  collectionId: z.union([z.string(), z.string().array()]).optional(),
})

export type AdminProductListQuery = FindParams<typeof AdminProductListParams>

export const ImageIdParams = z.object({ id: z.string().min(1), imageId: z.string().min(1) })
export type ImageIdParams = z.infer<typeof ImageIdParams>
