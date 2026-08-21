import { z } from 'zod'
import { bigNumberToString, dateToIso } from '../../common.js'

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
    metadata: z.string().nullable(),
    prices: z.array(AdminVariantPrice).optional(),
  })
  .openapi('AdminProductVariant')
export type AdminProductVariant = z.input<typeof AdminProductVariant>
