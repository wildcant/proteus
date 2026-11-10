import { z } from 'zod'
import { entityId, longText, machineCode, shortText } from '../../bounded.js'

export const AdminCreateProductCategory = z
  .object({
    name: shortText.min(1),
    /** Generated from the name when absent. */
    handle: machineCode.min(1).optional(),
    description: longText.optional(),
    /** Fixed at creation. Absent or null places the Category at the root. */
    parentId: entityId.min(1).nullable().optional(),
    /** Position among the new siblings. Absent appends. */
    rank: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    isInternal: z.boolean().optional(),
  })
  .openapi('AdminCreateProductCategory')
export type AdminCreateProductCategoryBody = z.infer<typeof AdminCreateProductCategory>

export const AdminUpdateProductCategory = z
  .object({
    name: shortText.min(1).optional(),
    handle: machineCode.min(1).optional(),
    description: longText.optional(),
    isActive: z.boolean().optional(),
    isInternal: z.boolean().optional(),
  })
  .openapi('AdminUpdateProductCategory')
export type AdminUpdateProductCategoryBody = z.infer<typeof AdminUpdateProductCategory>
