import { z } from 'zod'
import { createDateOperatorMap, createFindParams, type FindParams } from '../../common.js'

export const VariantIdParams = z.object({ id: z.string().min(1), variantId: z.string().min(1) })
export type VariantIdParams = z.infer<typeof VariantIdParams>

export const AdminProductVariantListParams = createFindParams({ limit: 10 }).extend({
  q: z.string().optional(),
  allowBackorder: z.union([z.boolean(), z.string().transform((v) => v === 'true')]).optional(),
  manageInventory: z.union([z.boolean(), z.string().transform((v) => v === 'true')]).optional(),
  createdAt: createDateOperatorMap().optional(),
})

export type AdminProductVariantListQuery = FindParams<typeof AdminProductVariantListParams>

/**
 * Searched and paginated server-side: the number of combinations is the product of the option
 * value counts, so it grows multiplicatively and cannot be shipped whole for every product.
 *
 * `label` rather than the usual `q` because combinations are computed, not rows — there is no
 * column for the framework's `searchableColumns` to build a filter against.
 */
export const AdminOptionCombinationListParams = createFindParams({ limit: 50 }).extend({
  label: z.string().optional(),
  /** `available` drops the combinations a variant already has. Defaults to all of them. */
  scope: z.enum(['all', 'available']).optional(),
  /** Kept in an `available` list even though it is taken — the variant doing the editing. */
  variantId: z.string().optional(),
})
export type AdminOptionCombinationListQuery = FindParams<typeof AdminOptionCombinationListParams>
