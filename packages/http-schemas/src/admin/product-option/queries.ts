import { z } from 'zod'
import { createFindParams, type FindParams, searchTerm } from '../../common.js'

export const OptionIdParams = z.object({ id: z.string().min(1), optionId: z.string().min(1) })
export type OptionIdParams = z.infer<typeof OptionIdParams>

export const AdminProductOptionListParams = createFindParams().extend({
  q: searchTerm,
})
export type AdminProductOptionListQuery = FindParams<typeof AdminProductOptionListParams>

export const AdminProductOptionValueListParams = createFindParams().extend({
  q: searchTerm,
})
export type AdminProductOptionValueListQuery = FindParams<typeof AdminProductOptionValueListParams>
