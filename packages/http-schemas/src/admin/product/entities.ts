import { z } from 'zod'
import { metadata, timestamps } from '../../common.js'

export const ProductStatus = z.enum(['draft', 'proposed', 'published', 'rejected'])

export const AdminProductImage = z
  .object({
    id: z.string(),
    url: z.string(),
    rank: z.number(),
  })
  .openapi('AdminProductImage')
export type AdminProductImage = z.input<typeof AdminProductImage>

export const AdminProduct = z
  .object({
    id: z.string(),
    title: z.string(),
    handle: z.string(),
    subtitle: z.string().nullable(),
    description: z.string().nullable(),
    isGiftcard: z.boolean(),
    status: ProductStatus,
    thumbnail: z.string().nullable(),
    weight: z.number().nullable(),
    length: z.number().nullable(),
    height: z.number().nullable(),
    width: z.number().nullable(),
    originCountry: z.string().nullable(),
    hsCode: z.string().nullable(),
    midCode: z.string().nullable(),
    material: z.string().nullable(),
    discountable: z.boolean(),
    externalId: z.string().nullable(),
    metadata,
    ...timestamps.shape,
  })
  .openapi('AdminProduct')
export type AdminProduct = z.input<typeof AdminProduct>
