import { z } from 'zod'
import { shortText } from '../../bounded.js'

export const AdminCreateProductImport = z
  .object({
    /** The uploaded CSV — upload it private. */
    fileId: shortText.min(1),
    /** Update products whose handle already exists, replacing the values of every column in the file. Needs `product.update`. */
    overwrite: z.boolean().default(false),
    /** Import active products published rather than as drafts. */
    publish: z.boolean().default(true),
  })
  .openapi('AdminCreateProductImport')
export type AdminCreateProductImportBody = z.infer<typeof AdminCreateProductImport>
