import { z } from 'zod'
import { stringToBigNumber } from '../../common.js'

export const CreateCart = z.object({
  email: z.email().optional(),
  items: z
    .array(
      z.object({
        title: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: stringToBigNumber,
        variantId: z.string().optional(),
        productId: z.string().optional(),
        productTitle: z.string().optional(),
        variantSku: z.string().optional(),
      }),
    )
    .optional(),
})
export type CreateCartBody = z.infer<typeof CreateCart>

export const UpdateCart = z.object({
  email: z.email().optional(),
})
export type UpdateCartBody = z.infer<typeof UpdateCart>

export const AddLineItem = z.object({
  title: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: stringToBigNumber,
  variantId: z.string().optional(),
  productId: z.string().optional(),
  productTitle: z.string().optional(),
  variantSku: z.string().optional(),
})
export type AddLineItemBody = z.infer<typeof AddLineItem>

export const UpdateLineItem = z.object({
  quantity: z.number().int().positive().optional(),
  unitPrice: stringToBigNumber.optional(),
})
export type UpdateLineItemBody = z.infer<typeof UpdateLineItem>

export const LineIdParams = z.object({
  id: z.string().min(1),
  lineId: z.string().min(1),
})
export type LineIdParams = z.infer<typeof LineIdParams>
