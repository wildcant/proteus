import { z } from 'zod'
import { AdminProductCategory, AdminProductCategoryTreeNode } from './entities.js'

export const AdminProductCategoryResponse = z
  .object({ productCategory: AdminProductCategory })
  .openapi('AdminProductCategoryResponse')
export type AdminProductCategoryResponse = z.input<typeof AdminProductCategoryResponse>

/** The whole tree, unpaginated — a shop has tens of Categories. */
export const AdminProductCategoryTreeResponse = z
  .object({ productCategories: z.array(AdminProductCategoryTreeNode) })
  .openapi('AdminProductCategoryTreeResponse')
export type AdminProductCategoryTreeResponse = z.input<typeof AdminProductCategoryTreeResponse>
