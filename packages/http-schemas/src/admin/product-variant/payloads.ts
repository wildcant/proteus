import { z } from 'zod'
import { stringToBigNumber } from '../../common.js'

const CreateVariantPrice = z.object({
  amount: stringToBigNumber,
})

const UpdateVariantPrice = z.object({
  id: z.string().optional(),
  amount: stringToBigNumber,
})

export const AdminCreateProductVariant = z
  .object({
    title: z.string().min(1),
    sku: z.string().nullable().optional(),
    barcode: z.string().nullable().optional(),
    ean: z.string().nullable().optional(),
    upc: z.string().nullable().optional(),
    allowBackorder: z.boolean().optional(),
    manageInventory: z.boolean().optional(),
    hsCode: z.string().nullable().optional(),
    originCountry: z.string().nullable().optional(),
    midCode: z.string().nullable().optional(),
    material: z.string().nullable().optional(),
    weight: z.number().nullable().optional(),
    length: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    width: z.number().nullable().optional(),
    variantRank: z.number().optional(),
    metadata: z.string().nullable().optional(),
    prices: z.array(CreateVariantPrice).optional(),
  })
  .openapi('AdminCreateProductVariant')
export type AdminCreateProductVariantBody = z.infer<typeof AdminCreateProductVariant>

export const AdminUpdateProductVariant = z
  .object({
    title: z.string().min(1).optional(),
    sku: z.string().nullable().optional(),
    barcode: z.string().nullable().optional(),
    ean: z.string().nullable().optional(),
    upc: z.string().nullable().optional(),
    allowBackorder: z.boolean().optional(),
    manageInventory: z.boolean().optional(),
    hsCode: z.string().nullable().optional(),
    originCountry: z.string().nullable().optional(),
    midCode: z.string().nullable().optional(),
    material: z.string().nullable().optional(),
    weight: z.number().nullable().optional(),
    length: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    width: z.number().nullable().optional(),
    variantRank: z.number().optional(),
    metadata: z.string().nullable().optional(),
  })
  .openapi('AdminUpdateProductVariant')
export type AdminUpdateProductVariantBody = z.infer<typeof AdminUpdateProductVariant>

export const AdminUpdateVariantPrices = z
  .object({
    prices: z.array(UpdateVariantPrice),
  })
  .openapi('AdminUpdateVariantPrices')
export type AdminUpdateVariantPricesBody = z.infer<typeof AdminUpdateVariantPrices>
