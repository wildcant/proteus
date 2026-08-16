import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

export const OptionIdParams = z.object({ id: z.string().min(1), optionId: z.string().min(1) })
export type OptionIdParams = z.infer<typeof OptionIdParams>

export const AdminProductOptionListParams = createFindParams().extend({
  q: z.string().optional(),
})
export type AdminProductOptionListQuery = FindParams<typeof AdminProductOptionListParams>
