import { z } from 'zod'
import type { AdminProductOption, AdminProductVariant, AdminUpdateProductVariantResponse } from '#/api/generated/model'
import { useUpdateProductVariant } from '#/features/products/api/product-variants'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

/**
 * Local rather than the http-schema: the form keeps empty strings where the payload wants
 * `null | undefined`, and `optionValues` is required here so every option renders a select.
 */
const editVariantSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  sku: z.string(),
  material: z.string(),
  optionValues: z.record(z.string(), z.string()),
})

export type EditVariantFormParams = SubmitFormParams<AdminUpdateProductVariantResponse>

type UseEditVariantFormArgs = {
  productId: string
  variant: AdminProductVariant
  /** The options this product offers, rank-ordered. One select is rendered per entry. */
  options: AdminProductOption[]
  params?: EditVariantFormParams
}

export function useEditVariantForm({ productId, variant, options, params }: UseEditVariantFormArgs) {
  const updateMutation = useUpdateProductVariant(productId, variant.id)

  const form = useAppForm({
    defaultValues: {
      title: variant.title,
      sku: variant.sku ?? '',
      material: variant.material ?? '',
      // Every option gets a key so an unset one submits as '' and is caught by the guard below.
      optionValues: Object.fromEntries(
        options.map((option) => [option.id, variant.optionValues[option.id] ?? '']),
      ) as Record<string, string>,
    },
    validators: { onSubmit: editVariantSchema },
    onSubmit: ({ value }) => {
      const { optionValues, sku, material, ...rest } = value
      // A product with no options must not send `{}` — that would clear the tuple rather than
      // leave it alone. Only send the map once every option has a value.
      const complete = options.length > 0 && options.every((option) => optionValues[option.id])

      updateMutation.mutate(
        {
          ...rest,
          sku: sku || null,
          material: material || null,
          ...(complete ? { optionValues } : {}),
        },
        {
          onSuccess: (data) => {
            form.reset()
            params?.onSuccess?.(data)
          },
          onError: (error) => params?.onError?.(error.message),
          onSettled: () => params?.onSettled?.(),
        },
      )
    },
  })

  return { form, isLoading: updateMutation.isPending }
}
