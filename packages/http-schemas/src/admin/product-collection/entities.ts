import { z } from 'zod'
import { dateToIso } from '../../common.js'
import { AdminProductGroupingRule } from '../product-metafield/entities.js'

export const AdminProductCollection = z
  .object({
    id: z.string(),
    title: z.string(),
    handle: z.string(),
    /** A URL from `POST /admin/uploads`. */
    thumbnail: z.string().nullable(),
    /** `null` is manual: the members are picked. A ruled Collection's members follow its rule. */
    rule: AdminProductGroupingRule.nullable(),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductCollection')
export type AdminProductCollection = z.input<typeof AdminProductCollection>
