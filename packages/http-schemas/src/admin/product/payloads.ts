import { z } from 'zod'
import { ProductStatus } from './entities.js'

const AdminCreateProductImage = z.object({ url: z.string().min(1) })
const AdminUpsertProductImage = z.object({ id: z.string().optional(), url: z.string().min(1) })

export const AdminCreateProduct = z
  .object({
    description: z.string().optional(),
    discountable: z.boolean().optional(),
    handle: z.string().optional(),
    height: z.number().nullable().optional(),
    hsCode: z.string().optional(),
    images: z.array(AdminCreateProductImage).optional(),
    length: z.number().nullable().optional(),
    material: z.string().optional(),
    midCode: z.string().optional(),
    originCountry: z.string().optional(),
    status: ProductStatus.optional(),
    subtitle: z.string().optional(),
    thumbnail: z.string().nullable().optional(),
    title: z.string().min(1),
    weight: z.number().nullable().optional(),
    width: z.number().nullable().optional(),
  })
  .openapi('AdminCreateProduct')
export type AdminCreateProductBody = z.infer<typeof AdminCreateProduct>

export const AdminUpdateProduct = z
  .object({
    images: z.array(AdminUpsertProductImage).optional(),
    thumbnail: z.string().nullable().optional(),
    title: z.string().min(1).optional(),
  })
  .openapi('AdminUpdateProduct')
export type AdminUpdateProductBody = z.infer<typeof AdminUpdateProduct>
