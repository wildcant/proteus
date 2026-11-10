import { z } from 'zod'
import { entityId, httpUrl, MAX_ITEMS, machineCode, shortText } from '../../bounded.js'

export const AdminCreateProductCollection = z
  .object({
    title: shortText.min(1),
    /** Generated from the title when absent. */
    handle: machineCode.min(1).optional(),
    thumbnail: httpUrl.nullable().optional(),
  })
  .openapi('AdminCreateProductCollection')
export type AdminCreateProductCollectionBody = z.infer<typeof AdminCreateProductCollection>

/** Never regenerates the handle. */
export const AdminUpdateProductCollection = z
  .object({
    title: shortText.min(1).optional(),
    handle: machineCode.min(1).optional(),
    thumbnail: httpUrl.nullable().optional(),
  })
  .openapi('AdminUpdateProductCollection')
export type AdminUpdateProductCollectionBody = z.infer<typeof AdminUpdateProductCollection>

/** Applied `add` then `remove`. Adding a member or removing a non-member is a no-op. */
export const AdminSetCollectionProducts = z
  .object({
    add: z.array(entityId).max(MAX_ITEMS.batch).optional(),
    remove: z.array(entityId).max(MAX_ITEMS.batch).optional(),
  })
  .openapi('AdminSetCollectionProducts')
export type AdminSetCollectionProductsBody = z.infer<typeof AdminSetCollectionProducts>
