import { z } from 'zod'
import { bigNumberToString, dateToIso, metadata } from '../../common.js'

export const AdminVariantPrice = z
  .object({
    id: z.string(),
    currencyCode: z.string(),
    amount: bigNumberToString,
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminVariantPrice')
export type AdminVariantPrice = z.input<typeof AdminVariantPrice>

/**
 * One entry of a variant's Option Combination, resolved for display. Ids for posting back, labels
 * for rendering — so no admin surface has to join against the product to show what a variant is.
 */
export const AdminVariantOptionValue = z
  .object({
    optionId: z.string(),
    optionTitle: z.string(),
    valueId: z.string(),
    value: z.string(),
  })
  .openapi('AdminVariantOptionValue')
export type AdminVariantOptionValue = z.input<typeof AdminVariantOptionValue>

export const AdminProductVariant = z
  .object({
    id: z.string(),
    productId: z.string(),
    title: z.string(),
    thumbnail: z.string().nullable(),
    sku: z.string().nullable(),
    barcode: z.string().nullable(),
    ean: z.string().nullable(),
    upc: z.string().nullable(),
    allowBackorder: z.boolean(),
    manageInventory: z.boolean(),
    hsCode: z.string().nullable(),
    originCountry: z.string().nullable(),
    midCode: z.string().nullable(),
    material: z.string().nullable(),
    weight: z.number().nullable(),
    length: z.number().nullable(),
    height: z.number().nullable(),
    width: z.number().nullable(),
    variantRank: z.number().nullable(),
    /** The variant's Option Combination, in the product's option order. Empty when it has none. */
    optionValues: z.array(AdminVariantOptionValue),
    metadata,
    prices: z.array(AdminVariantPrice).optional(),
  })
  .openapi('AdminProductVariant')
export type AdminProductVariant = z.input<typeof AdminProductVariant>

/**
 * An Option Combination this product could sell — one Product Option Value per option it offers.
 *
 * One list serves every surface: the create form takes the ones with no `variantId`, the edit form
 * those plus the variant's own, and the matrix step shows all of them. Computed by the same
 * function that rejects duplicates on save, so what the admin is offered and what the API accepts
 * cannot drift apart.
 */
export const AdminOptionCombination = z
  .object({
    /** Stable identity, independent of key order — the combobox's value. */
    key: z.string(),
    /** The values joined in the product's option order, e.g. `"M / White"`. */
    label: z.string(),
    values: z.array(AdminVariantOptionValue),
    /** The map to send back as `optionValues` when creating or updating a variant. */
    optionValues: z.record(z.string(), z.string()),
    /** The variant carrying this combination, or `null` while it is still available. */
    variantId: z.string().nullable(),
  })
  .openapi('AdminOptionCombination')
export type AdminOptionCombination = z.input<typeof AdminOptionCombination>
