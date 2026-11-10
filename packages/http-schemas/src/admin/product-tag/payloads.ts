import { z } from 'zod'
import { shortText } from '../../bounded.js'

/** Stored as sent: uniqueness is exact and case-sensitive. */
export const AdminCreateProductTag = z
  .object({
    value: shortText.min(1),
  })
  .openapi('AdminCreateProductTag')
export type AdminCreateProductTagBody = z.infer<typeof AdminCreateProductTag>

export const AdminUpdateProductTag = z
  .object({
    value: shortText.min(1).optional(),
  })
  .openapi('AdminUpdateProductTag')
export type AdminUpdateProductTagBody = z.infer<typeof AdminUpdateProductTag>
