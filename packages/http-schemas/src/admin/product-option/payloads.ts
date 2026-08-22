import { z } from 'zod'
import { metadata } from '../../common.js'
import { ProductOptionRenderAs } from './entities.js'

const CreateOptionValue = z.object({
  value: z.string().min(1),
  rank: z.number().int().min(0).optional(),
  metadata: metadata.optional(),
})

export const AdminCreateProductOption = z
  .object({
    title: z.string().min(1),
    renderAs: ProductOptionRenderAs.optional(),
    metadata: metadata.optional(),
    values: z.array(CreateOptionValue).optional(),
  })
  .openapi('AdminCreateProductOption')
export type AdminCreateProductOptionBody = z.infer<typeof AdminCreateProductOption>

export const AdminUpdateProductOption = z
  .object({
    title: z.string().min(1).optional(),
    renderAs: ProductOptionRenderAs.optional(),
    metadata: metadata.optional(),
    values: z.array(CreateOptionValue).optional(),
  })
  .openapi('AdminUpdateProductOption')
export type AdminUpdateProductOptionBody = z.infer<typeof AdminUpdateProductOption>

const SetProductOptionEntry = z.object({
  optionId: z.string().min(1),
  valueIds: z.array(z.string().min(1)),
})

export const AdminSetProductOptions = z
  .object({
    options: z.array(SetProductOptionEntry),
  })
  .openapi('AdminSetProductOptions')
export type AdminSetProductOptionsBody = z.infer<typeof AdminSetProductOptions>
