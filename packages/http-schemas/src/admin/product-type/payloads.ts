import { z } from 'zod'
import { shortText } from '../../bounded.js'

/** Stored as sent: uniqueness is exact and case-sensitive. */
export const AdminCreateProductType = z
  .object({
    value: shortText.min(1),
  })
  .openapi('AdminCreateProductType')
export type AdminCreateProductTypeBody = z.infer<typeof AdminCreateProductType>

export const AdminUpdateProductType = z
  .object({
    value: shortText.min(1).optional(),
  })
  .openapi('AdminUpdateProductType')
export type AdminUpdateProductTypeBody = z.infer<typeof AdminUpdateProductType>
