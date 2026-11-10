import { z } from 'zod'
import { dateToIso } from '../../common.js'

export const AdminProductCollection = z
  .object({
    id: z.string(),
    title: z.string(),
    handle: z.string(),
    /** A URL from `POST /admin/uploads`. */
    thumbnail: z.string().nullable(),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductCollection')
export type AdminProductCollection = z.input<typeof AdminProductCollection>
