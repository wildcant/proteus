import { z } from 'zod'
import { bigNumberToString } from '../../common.js'

export const StoreCalculatedPrice = z
  .object({
    id: z.string(),
    currencyCode: z.string(),
    originalAmount: bigNumberToString,
    // TODO(pricing): add calculatedAmount when PriceRule/PriceList is implemented
    // TODO(tax): add originalAmountWithTax, originalAmountWithoutTax
  })
  .openapi('StoreCalculatedPrice')

export const StoreProductVariant = z
  .object({
    id: z.string(),
    productId: z.string(),
    title: z.string(),
    sku: z.string().nullable(),
    barcode: z.string().nullable(),
    material: z.string().nullable(),
    weight: z.number().nullable(),
    length: z.number().nullable(),
    height: z.number().nullable(),
    width: z.number().nullable(),
    calculatedPrice: StoreCalculatedPrice,
  })
  .openapi('StoreProductVariant')
export type StoreProductVariant = z.infer<typeof StoreProductVariant>

export const StoreProduct = z
  .object({
    id: z.string(),
    title: z.string(),
    handle: z.string(),
    subtitle: z.string().nullable(),
    description: z.string().nullable(),
    thumbnail: z.string().nullable(),
    weight: z.number().nullable(),
    length: z.number().nullable(),
    height: z.number().nullable(),
    width: z.number().nullable(),
    originCountry: z.string().nullable(),
    material: z.string().nullable(),
  })
  .openapi('StoreProduct')
export type StoreProduct = z.infer<typeof StoreProduct>

export const StoreProductListItem = StoreProduct.extend({
  startingPrice: StoreCalculatedPrice.optional(),
}).openapi('StoreProductListItem')
export type StoreProductListItem = z.infer<typeof StoreProductListItem>
