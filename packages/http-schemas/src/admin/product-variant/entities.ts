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
    /** The variant's option tuple, keyed by option id. Empty when it carries no options. */
    optionValues: z.record(z.string(), z.string()),
    metadata,
    prices: z.array(AdminVariantPrice).optional(),
  })
  .openapi('AdminProductVariant')
export type AdminProductVariant = z.input<typeof AdminProductVariant>
