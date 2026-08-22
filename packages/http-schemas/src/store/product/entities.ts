import { z } from 'zod'
import { bigNumberToString } from '../../common.js'

export const StoreCalculatedPrice = z
  .object({
    id: z.string(),
    currencyCode: z.string(),
    calculatedAmount: bigNumberToString,
    // TODO(pricing): add originalAmount when PriceRule/PriceList is implemented
    // TODO(tax): add calculatedAmountWithTax, calculatedAmountWithoutTax
  })
  .openapi('StoreCalculatedPrice')

export const StoreProductImage = z
  .object({
    id: z.string(),
    url: z.string(),
    rank: z.number(),
  })
  .openapi('StoreProductImage')
export type StoreProductImage = z.infer<typeof StoreProductImage>

export const StoreProductVariant = z
  .object({
    id: z.string(),
    productId: z.string(),
    title: z.string(),
    thumbnail: z.string().nullable(),
    /** Ids into the product's `images`, in image rank order. Empty when the variant has no links. */
    imageIds: z.array(z.string()),
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
