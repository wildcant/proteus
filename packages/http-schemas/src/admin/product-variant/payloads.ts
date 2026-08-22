import { z } from 'zod'
import { metadata, stringToBigNumber } from '../../common.js'

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
    thumbnail: z.string().nullable().optional(),
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
    /**
     * The variant's option tuple, keyed by option id. Omit to leave an existing tuple untouched;
     * send `{}` to clear it. When set it must name every option the product offers.
     */
    optionValues: z.record(z.string(), z.string()).optional(),
    metadata: metadata.optional(),
    prices: z.array(CreateVariantPrice).optional(),
  })
  .openapi('AdminCreateProductVariant')
export type AdminCreateProductVariantBody = z.infer<typeof AdminCreateProductVariant>

export const AdminUpdateProductVariant = z
  .object({
    title: z.string().min(1).optional(),
    thumbnail: z.string().nullable().optional(),
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
    /**
     * The variant's option tuple, keyed by option id. Omit to leave an existing tuple untouched;
     * send `{}` to clear it. When set it must name every option the product offers.
     */
    optionValues: z.record(z.string(), z.string()).optional(),
    metadata: metadata.optional(),
  })
  .openapi('AdminUpdateProductVariant')
export type AdminUpdateProductVariantBody = z.infer<typeof AdminUpdateProductVariant>

export const AdminUpdateVariantPrices = z
  .object({
    prices: z.array(UpdateVariantPrice),
  })
  .openapi('AdminUpdateVariantPrices')
export type AdminUpdateVariantPricesBody = z.infer<typeof AdminUpdateVariantPrices>

export const AdminCreateProductVariantsBatch = z
  .object({
    variants: z.array(AdminCreateProductVariant).min(1),
  })
  .openapi('AdminCreateProductVariantsBatch')
export type AdminCreateProductVariantsBatchBody = z.infer<typeof AdminCreateProductVariantsBatch>
