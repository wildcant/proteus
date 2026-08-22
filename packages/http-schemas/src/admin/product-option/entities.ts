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
    metadata,
    /** This product's subset, in this product's order. Its position is the rank. */
    values: z.array(AdminProductScopedOptionValue),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductScopedOption')
export type AdminProductScopedOption = z.input<typeof AdminProductScopedOption>
