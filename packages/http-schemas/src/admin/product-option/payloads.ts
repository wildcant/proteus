import { z } from 'zod'
import { metadata } from '../../common.js'
import { ProductOptionRenderAs } from './entities.js'

const CreateOptionValue = z.object({
  value: z.string().min(1),
  rank: z.number().int().min(0).optional(),
  metadata: metadata.optional(),
})

/**
 * A known `id` renames the value in place and keeps every variant link intact; without one the
 * value is created. Values the payload leaves out are removed.
 */
const UpsertOptionValue = z.object({
  id: z.string().optional(),
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
    values: z.array(UpsertOptionValue).optional(),
  })
  .openapi('AdminUpdateProductOption')
export type AdminUpdateProductOptionBody = z.infer<typeof AdminUpdateProductOption>

/**
 * One option a product offers, and which of its values.
 *
 * `valueIds` must name at least one: an option a product offers with nothing to choose from is not
 * a dimension the product varies along — drop the option instead. It used to mean "every value the
 * option has", which made deselecting the last value a silent widening rather than the removal the
 * shopkeeper intended.
 *
 * Exported because product creation takes the same entry. Two copies drifted once already, which
 * is the whole argument for one.
 */
export const AdminSetProductOptionEntry = z.object({
  optionId: z.string().min(1),
  valueIds: z.array(z.string().min(1)).min(1),
})

export const AdminSetProductOptions = z
  .object({
    options: z.array(AdminSetProductOptionEntry),
  })
  .openapi('AdminSetProductOptions')
export type AdminSetProductOptionsBody = z.infer<typeof AdminSetProductOptions>
