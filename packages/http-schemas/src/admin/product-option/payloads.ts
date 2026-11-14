import { z } from 'zod'
import { entityId, MAX_ITEMS, MAX_LENGTH, shortText } from '../../bounded.js'
import { metadata } from '../../common.js'
import { ProductOptionListingRole, ProductOptionRenderAs } from './entities.js'

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

/** A bucket as written; its place in the array is its rank. */
const OptionBucketInput = z.object({
  name: shortText.min(1),
  /** Free text the storefront reads as it likes (a hex, a CSS colour, an image URL, a key), up to a URL's length. */
  swatch: z.string().min(1).max(MAX_LENGTH.url).nullable().optional(),
  words: z.array(shortText.min(1)).max(MAX_ITEMS.batch).optional(),
})

export const AdminCreateProductOption = z
  .object({
    title: shortText.min(1),
    renderAs: ProductOptionRenderAs.optional(),
    listingRole: z.union([ProductOptionListingRole, z.null()]).optional(),
    /** Replaces the buckets, in rank order, and regroups every value. */
    buckets: z.array(OptionBucketInput).max(MAX_ITEMS.batch).optional(),
    metadata: metadata.optional(),
    values: z.array(CreateOptionValue).max(MAX_ITEMS.batch).optional(),
  })
  .openapi('AdminCreateProductOption')
export type AdminCreateProductOptionBody = z.infer<typeof AdminCreateProductOption>

export const AdminUpdateProductOption = z
  .object({
    title: shortText.min(1).optional(),
    renderAs: ProductOptionRenderAs.optional(),
    listingRole: z.union([ProductOptionListingRole, z.null()]).optional(),
    /** Replaces the buckets, in rank order, and regroups every value. */
    buckets: z.array(OptionBucketInput).max(MAX_ITEMS.batch).optional(),
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
