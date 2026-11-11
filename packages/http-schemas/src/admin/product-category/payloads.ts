import { z } from 'zod'
import { entityId, longText, MAX_ITEMS, machineCode, shortText } from '../../bounded.js'
import { AdminProductGroupingRule } from '../product-tag/entities.js'

export const AdminCreateProductCategory = z
  .object({
    name: shortText.min(1),
    /** Generated from the name when absent. */
    handle: machineCode.min(1).optional(),
    description: longText.optional(),
    /** Absent or null places the Category at the root. */
    parentId: entityId.min(1).nullable().optional(),
    /** Position among the new siblings. Absent appends. */
    rank: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    isInternal: z.boolean().optional(),
    /** Absent or null makes a manual Category. A rule fills it with the products that match. */
    rule: AdminProductGroupingRule.nullable().optional(),
  })
  .openapi('AdminCreateProductCategory')
export type AdminCreateProductCategoryBody = z.infer<typeof AdminCreateProductCategory>

/** Applied `add` then `remove`. Adding a member or removing a non-member is a no-op. Refused for a ruled Category. */
export const AdminSetCategoryProducts = z
  .object({
    add: z.array(entityId).max(MAX_ITEMS.batch).optional(),
    remove: z.array(entityId).max(MAX_ITEMS.batch).optional(),
  })
  .openapi('AdminSetCategoryProducts')
export type AdminSetCategoryProductsBody = z.infer<typeof AdminSetCategoryProducts>

export const AdminUpdateProductCategory = z
  .object({
    name: shortText.min(1).optional(),
    handle: machineCode.min(1).optional(),
    description: longText.optional(),
    /** Absent keeps the parent; null moves the Category to the root. Never under itself or a descendant. */
    parentId: entityId.min(1).nullable().optional(),
    /** Position among the siblings it lands in. Absent appends when the parent changes. */
    rank: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    isInternal: z.boolean().optional(),
    /** A new rule re-matches every product. Null makes it manual and keeps the members it has. */
    rule: AdminProductGroupingRule.nullable().optional(),
  })
  .openapi('AdminUpdateProductCategory')
export type AdminUpdateProductCategoryBody = z.infer<typeof AdminUpdateProductCategory>
