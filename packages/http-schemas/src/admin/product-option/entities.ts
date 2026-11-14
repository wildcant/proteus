import { z } from 'zod'
import { dateToIso, metadata } from '../../common.js'

/** How the storefront draws this option's values. */
export const ProductOptionRenderAs = z.enum(['text', 'swatch'])
export type ProductOptionRenderAs = z.infer<typeof ProductOptionRenderAs>

/**
 * The part the option plays on a store's list card: `grouping`, its values each have their own look
 * and photo (colour, material); `availability`, the card lists its in-stock values (size). A product
 * reads the first option in its option order for each role.
 */
export const ProductOptionListingRole = z.enum(['grouping', 'availability'])
export type ProductOptionListingRole = z.infer<typeof ProductOptionListingRole>

/** A group the store filter offers in place of the option's raw values. */
export const AdminProductOptionBucket = z
  .object({
    id: z.string(),
    name: z.string(),
    /** Whatever the storefront draws the bucket's swatch from: a hex, a CSS colour, an image URL, a key. */
    swatch: z.string().nullable(),
    /** A value joins every bucket holding one of its words. */
    words: z.array(z.string()),
    rank: z.number(),
    /** The option's values in the bucket; a value in none is counted as itself. */
    valueIds: z.array(z.string()),
  })
  .openapi('AdminProductOptionBucket')
export type AdminProductOptionBucket = z.input<typeof AdminProductOptionBucket>

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
    listingRole: z.union([ProductOptionListingRole, z.null()]),
    metadata,
    values: z.array(AdminProductOptionValue),
    /** In rank order; empty when the store filter offers the raw values. */
    buckets: z.array(AdminProductOptionBucket),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductOption')
export type AdminProductOption = z.input<typeof AdminProductOption>

/**
 * A Product Option Value as one product offers it — the catalogue value plus how many of that
 * product's variants carry it.
 *
 * Spelled out rather than `.extend()`-ed: an extended schema becomes an OpenAPI `allOf`, which the
 * client generator turns into an intersection whose overridden fields go optional.
 */
export const AdminProductScopedOptionValue = z
  .object({
    id: z.string(),
    optionId: z.string(),
    value: z.string(),
    rank: z.number().nullable(),
    /** Variants of this product carrying the value. Non-zero means it cannot be unlinked yet. */
    variantCount: z.number(),
    metadata,
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductScopedOptionValue')
export type AdminProductScopedOptionValue = z.input<typeof AdminProductScopedOptionValue>

/**
 * A Product Option as one particular product offers it: the option, only the subset of its values
 * that product sells, in that product's display order.
 *
 * Deliberately not `AdminProductOption` — the global option owns *all* its values, and treating the
 * two as one type is what left consumers guessing which they were holding.
 */
export const AdminProductScopedOption = z
  .object({
    id: z.string(),
    title: z.string(),
    renderAs: ProductOptionRenderAs,
    listingRole: z.union([ProductOptionListingRole, z.null()]),
    metadata,
    /** This product's subset, in this product's order. Its position is the rank. */
    values: z.array(AdminProductScopedOptionValue),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductScopedOption')
export type AdminProductScopedOption = z.input<typeof AdminProductScopedOption>
