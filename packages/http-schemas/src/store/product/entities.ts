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

export const StoreProductScopedOptionValue = z
  .object({
    id: z.string(),
    value: z.string(),
    rank: z.number().nullable(),
    /**
     * The image a swatch shows for this value — the first image of the first variant carrying it.
     * Resolved here because it does not depend on what the shopper has selected.
     */
    swatchImageUrl: z.string().nullable(),
  })
  .openapi('StoreProductScopedOptionValue')
export type StoreProductScopedOptionValue = z.infer<typeof StoreProductScopedOptionValue>

/**
 * A Product Option as this product offers it: only the values it sells, in its own display order.
 * The storefront never sees the global option, so this is the only shape it knows.
 */
export const StoreProductScopedOption = z
  .object({
    id: z.string(),
    title: z.string(),
    /** How the picker draws this option's values. */
    renderAs: z.enum(['text', 'swatch']),
    values: z.array(StoreProductScopedOptionValue),
  })
  .openapi('StoreProductScopedOption')
export type StoreProductScopedOption = z.infer<typeof StoreProductScopedOption>

export const StoreProductVariant = z
  .object({
    id: z.string(),
    productId: z.string(),
    title: z.string(),
    thumbnail: z.string().nullable(),
    /** Ids into the product's `images`, in image rank order. Empty when the variant has no links. */
    imageIds: z.array(z.string()),
    /**
     * The variant's Option Combination, keyed by option id. Ids rather than labels: the picker only
     * ever compares these, and the labels already ship once on `product.options`.
     */
    optionValues: z.record(z.string(), z.string()),
    /** Whether every inventory item this variant needs covers its required quantity. */
    inStock: z.boolean(),
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
