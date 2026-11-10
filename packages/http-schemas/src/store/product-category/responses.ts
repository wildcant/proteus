import { z } from 'zod'
import { StoreProductCategoryTreeNode } from './entities.js'

/** The Visible tree, unpaginated — a shop has tens of Categories. */
export const StoreProductCategoryTreeResponse = z
  .object({ productCategories: z.array(StoreProductCategoryTreeNode) })
  .openapi('StoreProductCategoryTreeResponse')
export type StoreProductCategoryTreeResponse = z.input<typeof StoreProductCategoryTreeResponse>
