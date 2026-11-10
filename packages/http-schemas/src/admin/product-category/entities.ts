import { z } from 'zod'
import { dateToIso } from '../../common.js'

export const AdminProductCategory = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    handle: z.string(),
    parentId: z.string().nullable(),
    /** Order among siblings, 0..n-1. */
    rank: z.number(),
    /** Shown on the store — when every ancestor is active and not internal too. */
    isActive: z.boolean(),
    /** Assignable in the admin, never shown on the store. */
    isInternal: z.boolean(),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductCategory')
export type AdminProductCategory = z.input<typeof AdminProductCategory>

/** A Category with its children nested, siblings in rank order. */
export const AdminProductCategoryTreeNode = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    handle: z.string(),
    parentId: z.string().nullable(),
    rank: z.number(),
    isActive: z.boolean(),
    isInternal: z.boolean(),
    createdAt: dateToIso,
    updatedAt: dateToIso,
    get children(): z.ZodArray<typeof AdminProductCategoryTreeNode> {
      return z.array(AdminProductCategoryTreeNode)
    },
  })
  .openapi('AdminProductCategoryTreeNode')
export type AdminProductCategoryTreeNode = z.input<typeof AdminProductCategoryTreeNode>
