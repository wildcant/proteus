import { z } from 'zod'
import { MAX_ITEMS, shortText } from '../../bounded.js'
import { dateToIso } from '../../common.js'

export const AdminProductTag = z
  .object({
    id: z.string(),
    value: z.string(),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductTag')
export type AdminProductTag = z.input<typeof AdminProductTag>

/**
 * A tag rule on a Category or Collection: every condition must hold, and a condition holds when the
 * product carries any one of its tag values. `[['genero:hombre', 'genero:unisex'], ['estilo:clasicos']]`
 * reads "(hombre or unisex) and clasicos". Values match tags exactly.
 */
export const AdminProductGroupingRule = z
  .array(z.array(shortText.min(1)).min(1).max(MAX_ITEMS.small))
  .min(1)
  .max(MAX_ITEMS.small)
  .openapi('AdminProductGroupingRule')
export type AdminProductGroupingRule = z.input<typeof AdminProductGroupingRule>
