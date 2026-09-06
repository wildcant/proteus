import { z } from 'zod'
import { entityId, MAX_ITEMS, shortText } from '../../bounded.js'
import { metadata } from '../../common.js'
import { ProductOptionRenderAs } from './entities.js'

const CreateOptionValue = z.object({
  value: shortText.min(1),
  rank: z.number().int().min(0).optional(),
  metadata: metadata.optional(),
})

/**
 * A known `id` renames the value in place and keeps every variant link intact; without one the
 * value is created. Values the payload leaves out are removed.
 */
const UpsertOptionValue = z.object({
  id: entityId.optional(),
  value: shortText.min(1),
  rank: z.number().int().min(0).optional(),
  metadata: metadata.optional(),
})

export const AdminCreateProductOption = z
  .object({
    title: shortText.min(1),
    renderAs: ProductOptionRenderAs.optional(),
    metadata: metadata.optional(),
    values: z.array(CreateOptionValue).max(MAX_ITEMS.batch).optional(),
  })
  .openapi('AdminCreateProductOption')
export type AdminCreateProductOptionBody = z.infer<typeof AdminCreateProductOption>

export const AdminUpdateProductOption = z
  .object({
    title: shortText.min(1).optional(),
    renderAs: ProductOptionRenderAs.optional(),
    metadata: metadata.optional(),
    values: z.array(UpsertOptionValue).max(MAX_ITEMS.batch).optional(),
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
  optionId: entityId.min(1),
  valueIds: z.array(entityId.min(1)).min(1).max(MAX_ITEMS.batch),
})

export const AdminSetProductOptions = z
  .object({
    options: z.array(AdminSetProductOptionEntry).max(MAX_ITEMS.small),
  })
  .openapi('AdminSetProductOptions')
export type AdminSetProductOptionsBody = z.infer<typeof AdminSetProductOptions>
