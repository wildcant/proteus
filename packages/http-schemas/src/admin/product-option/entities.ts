import { z } from 'zod'
import { dateToIso, metadata } from '../../common.js'

/** How the storefront draws this option's values. */
export const ProductOptionRenderAs = z.enum(['text', 'swatch'])
export type ProductOptionRenderAs = z.infer<typeof ProductOptionRenderAs>

export const AdminProductOptionValue = z
  .object({
    id: z.string(),
    optionId: z.string(),
    value: z.string(),
    rank: z.number().nullable(),
    metadata,
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductOptionValue')
export type AdminProductOptionValue = z.input<typeof AdminProductOptionValue>

export const AdminProductOption = z
  .object({
    id: z.string(),
    title: z.string(),
    renderAs: ProductOptionRenderAs,
    metadata,
    values: z.array(AdminProductOptionValue),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductOption')
export type AdminProductOption = z.input<typeof AdminProductOption>
