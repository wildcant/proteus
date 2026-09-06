import { z } from 'zod'
import { entityId, httpUrl, MAX_ITEMS, machineCode, shortText } from '../../bounded.js'
import { amountToBigNumber, metadata } from '../../common.js'

const CreateVariantPrice = z.object({
  amount: amountToBigNumber,
})

const UpdateVariantPrice = z.object({
  id: entityId.optional(),
  amount: amountToBigNumber,
})

export const AdminCreateProductVariant = z
  .object({
    thumbnail: httpUrl.nullable().optional(),
    sku: machineCode.nullable().optional(),
    barcode: machineCode.nullable().optional(),
    ean: machineCode.nullable().optional(),
    upc: machineCode.nullable().optional(),
    allowBackorder: z.boolean().optional(),
    manageInventory: z.boolean().optional(),
    hsCode: machineCode.nullable().optional(),
    originCountry: machineCode.nullable().optional(),
    midCode: machineCode.nullable().optional(),
    material: shortText.nullable().optional(),
    weight: z.number().nullable().optional(),
    length: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    width: z.number().nullable().optional(),
    variantRank: z.number().optional(),
    /**
     * The Option Combination this variant carries, keyed by option id. It must name every option
     * the product offers, and must be one no other variant already has. Only a product with no
     * options takes `{}`.
     */
    optionValues: z.record(z.string(), entityId),
    metadata: metadata.optional(),
    prices: z.array(CreateVariantPrice).max(MAX_ITEMS.batch).optional(),
  })
  .openapi('AdminCreateProductVariant')
export type AdminCreateProductVariantBody = z.infer<typeof AdminCreateProductVariant>

export const AdminUpdateProductVariant = z
  .object({
    thumbnail: httpUrl.nullable().optional(),
    sku: machineCode.nullable().optional(),
    barcode: machineCode.nullable().optional(),
    ean: machineCode.nullable().optional(),
    upc: machineCode.nullable().optional(),
    allowBackorder: z.boolean().optional(),
    manageInventory: z.boolean().optional(),
    hsCode: machineCode.nullable().optional(),
    originCountry: machineCode.nullable().optional(),
    midCode: machineCode.nullable().optional(),
    material: shortText.nullable().optional(),
    weight: z.number().nullable().optional(),
    length: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    width: z.number().nullable().optional(),
    variantRank: z.number().optional(),
    /**
     * The Option Combination to move this variant onto, keyed by option id. Omit to leave the
     * existing one alone; send `{}` to clear it. When set it must name every option the product
     * offers, and must be a combination no other variant already has.
     */
    optionValues: z.record(z.string(), entityId).optional(),
    metadata: metadata.optional(),
  })
  .openapi('AdminUpdateProductVariant')
export type AdminUpdateProductVariantBody = z.infer<typeof AdminUpdateProductVariant>

export const AdminUpdateVariantPrices = z
  .object({
    prices: z.array(UpdateVariantPrice).max(MAX_ITEMS.batch),
  })
  .openapi('AdminUpdateVariantPrices')
export type AdminUpdateVariantPricesBody = z.infer<typeof AdminUpdateVariantPrices>

export const AdminCreateProductVariantsBatch = z
  .object({
    variants: z.array(AdminCreateProductVariant).min(1).max(MAX_ITEMS.bulk),
  })
  .openapi('AdminCreateProductVariantsBatch')
export type AdminCreateProductVariantsBatchBody = z.infer<typeof AdminCreateProductVariantsBatch>
