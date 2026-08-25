import { AdminCreateProduct } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import { mediaSchema } from '#/features/products/media.ts'

export const detailsSchema = AdminCreateProduct.pick({
  title: true,
  subtitle: true,
  handle: true,
  description: true,
})

export const organizeSchema = AdminCreateProduct.pick({
  discountable: true,
})

export const attributesSchema = AdminCreateProduct.pick({
  material: true,
  originCountry: true,
  hsCode: true,
  midCode: true,
  weight: true,
  length: true,
  height: true,
  width: true,
})

/**
 * The variant matrix. The first tab whose shape is not a slice of `AdminCreateProduct` — a matrix
 * of rows is not a product field, and forcing it into that shape would distort both.
 */
export const variantsSchema = z.object({
  /** Off means the product is not sold in variations; one variant is created for it. */
  hasVariants: z.boolean(),
  // `valueIds` needs at least one, matching the endpoint. The selector already drops an option when
  // its last value is deselected, so this is the form agreeing rather than a second gate.
  options: z.array(z.object({ optionId: z.string().min(1), valueIds: z.array(z.string().min(1)).min(1) })),
  rows: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      optionValues: z.record(z.string(), z.string()),
      sku: z.string(),
      price: z.string(),
    }),
  ),
})

export const productFormSchema = z.object({
  details: detailsSchema,
  organize: organizeSchema,
  attributes: attributesSchema,
  variants: variantsSchema,
  // Staged client-side, so it sits beside the tab groups rather than inside one.
  media: mediaSchema,
})

export type ProductFormValues = z.infer<typeof productFormSchema>
