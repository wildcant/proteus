import { i18n } from '@proteus/utils'
import { z } from 'zod'
import { MAX_ITEMS, machineCode, shortText } from '../../bounded.js'

/** One of a product's metafields with its values, in the order they were written. */
export const AdminProductMetafield = z
  .object({ key: z.string(), name: z.string(), values: z.array(z.string()) })
  .openapi('AdminProductMetafield')
export type AdminProductMetafield = z.input<typeof AdminProductMetafield>

/**
 * A rule on a Category or Collection: one condition per metafield key, every condition must hold, and
 * a condition holds when the product's metafield carries any one of its values.
 * `{ genero: ['hombre', 'unisex'], estilo: ['clasicos'] }` reads "(hombre or unisex) and clasicos".
 * Every key must be a defined metafield; values match exactly.
 */
export const AdminProductGroupingRule = z
  .record(machineCode.min(1), z.array(shortText.min(1)).min(1).max(MAX_ITEMS.small))
  .refine((rule) => Object.keys(rule).length > 0, i18n.t('Must hold at least one condition.'))
  // MAX_ITEMS.small: a record has no `.max()`, so the ceiling is checked here.
  .refine((rule) => Object.keys(rule).length <= MAX_ITEMS.small, i18n.t('Must hold no more than 20 conditions.'))
  .openapi('AdminProductGroupingRule')
export type AdminProductGroupingRule = z.input<typeof AdminProductGroupingRule>
