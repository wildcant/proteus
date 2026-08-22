import { z } from 'zod'
import type { AdminCreateProductVariantResponse, AdminOptionCombination } from '#/api/generated/model'
import { useCreateProductVariant } from '#/features/products/api/product-variants'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

/**
 * The form holds the chosen combination itself, not its key — the payload needs its `optionValues`
 * and the title placeholder its `label`, so a key would only have to be resolved back again at
 * submit time. Picking a combination is one choice, so it is one field.
 *
 * Title and SKU stay optional: an omitted title takes the combination's label server-side.
 */
const createVariantSchema = z.object({
  combination: z.custom<AdminOptionCombination>().nullable(),
  title: z.string(),
  sku: z.string(),
})

type UseCreateVariantFormArgs = {
  productId: string
  params?: SubmitFormParams<AdminCreateProductVariantResponse>
}

export function useCreateVariantForm({ productId, params }: UseCreateVariantFormArgs) {
  const createMutation = useCreateProductVariant(productId)

  // Annotated rather than `satisfies`, which would narrow the empty combination to `null` and
  // leave the field unable to hold one.
  const defaultValues: z.infer<typeof createVariantSchema> = { combination: null, title: '', sku: '' }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: createVariantSchema },
    onSubmit: ({ value }) => {
      createMutation.mutate(
        {
          // Omitted rather than sent empty, so the service falls back to the combination's label.
          ...(value.title ? { title: value.title } : {}),
          sku: value.sku || null,
          ...(value.combination ? { optionValues: value.combination.optionValues } : {}),
        },
        {
          onSuccess: (created) => {
            form.reset()
            params?.onSuccess?.(created)
          },
          onError: (error) => params?.onError?.(error.message),
          onSettled: () => params?.onSettled?.(),
        },
      )
    },
  })

  return { form, isLoading: createMutation.isPending }
}
