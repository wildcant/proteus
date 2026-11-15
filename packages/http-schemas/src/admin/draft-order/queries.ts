import { z } from 'zod'

export const DraftOrderItemParams = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
})
export type DraftOrderItemParams = z.infer<typeof DraftOrderItemParams>
