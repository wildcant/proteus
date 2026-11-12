import { AdminUpdateProduct } from '@proteus/http-schemas/admin'
import type { z } from 'zod'
import type { AdminGroupedProduct, AdminUpdateProductResponse } from '#/api/generated/model'
import { useUpdateProduct } from '#/features/products/api/products'
import { organizationSchema } from '#/features/products/components/create-product-form/schemas'
import { useAppForm } from '#/lib/form-hook.ts'
import { toValueOption } from '#/lib/value-option'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type EditProductOrganizationFormParams = SubmitFormParams<AdminUpdateProductResponse>

/**
 * What the product is grouped under. Saving sends the whole set, which replaces the product's own.
 * Only hand-picked Categories and Collections are in it: the server puts the ruled ones back.
 */
export function useEditProductOrganizationForm(
  product: AdminGroupedProduct,
  params?: EditProductOrganizationFormParams,
) {
  const updateMutation = useUpdateProduct(product.id)

  const defaultValues: z.input<typeof organizationSchema> = {
    type: product.type ? toValueOption(product.type) : null,
    categoryIds: product.categories.filter((category) => !category.rule).map((category) => category.id),
    collectionIds: product.collections.filter((collection) => !collection.rule).map((collection) => collection.id),
    tagIds: product.tags.map((tag) => tag.id),
  }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: organizationSchema },
    onSubmit: async ({ value }) => {
      try {
        const { type, ...groupings } = value
        const data = await updateMutation.mutateAsync(
          AdminUpdateProduct.parse({ ...groupings, typeId: type?.id ?? null }),
        )
        form.reset()
        params?.onSuccess?.(data)
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
