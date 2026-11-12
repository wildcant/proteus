import { i18n } from '@proteus/utils'
import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

/** One metafield selection, `<key>:<value>`. The value is everything after the first colon. */
const metafieldSelection = z.string().regex(/^[^:]+:.+$/s, i18n.t('Write a filter as key:value'))

export const StoreProductListParams = createFindParams().extend({
  q: z.string().optional(),
  /** A Category's handle. Lists its products and its Visible descendants'; a hidden Category matches nothing. */
  category: z.string().min(1).optional(),
  /** A Collection's handle. Lists its members; an unknown or deleted Collection matches nothing. */
  collection: z.string().min(1).optional(),
  /** Tag values, repeatable. Lists products carrying any of them; an unknown value matches nothing. */
  tag: z.union([z.string().min(1), z.string().min(1).array()]).optional(),
  /**
   * Metafield selections as `<key>:<value>`, repeatable: `filter=genero:women&filter=tipo:tops`.
   * Lists products holding any of the values chosen for a key, for every key chosen; an unknown key
   * matches nothing.
   */
  filter: z.union([metafieldSelection, metafieldSelection.array()]).optional(),
})

export type StoreProductListQuery = FindParams<typeof StoreProductListParams>
