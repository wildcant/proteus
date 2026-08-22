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
 * The combination is required — a variant *is* one combination of the product's option values, and
 * the server rejects a create that names none. Title and SKU stay optional: an omitted title takes
 * the combination's label server-side.
 */
const createVariantSchema = z.object({
  combination: z
    .custom<AdminOptionCombination>()
    .nullable()
    .refine((combination) => combination !== null, { message: 'Pick a combination.' }),
  title: z.string(),
  sku: z.string(),
})

type UseCreateVariantFormArgs = {
  productId: string
  params?: SubmitFormParams<AdminCreateProductVariantResponse>
}

export function useCreateVariantForm({ productId, params }: UseCreateVariantFormArgs) {
  const createMutation = useCreateProductVariant(productId)

  // `z.input`, not `z.infer`: the schema's output has the combination narrowed to non-null, which
  // is the point of it — the field still has to start empty and hold one.
  const defaultValues: z.input<typeof createVariantSchema> = { combination: null, title: '', sku: '' }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: createVariantSchema },
    onSubmit: ({ value }) => {
      // The schema has already rejected a null combination; this only narrows it for the payload.
      if (!value.combination) return

      createMutation.mutate(
        {
          // Omitted rather than sent empty, so the service falls back to the combination's label.
          ...(value.title ? { title: value.title } : {}),
          sku: value.sku || null,
          optionValues: value.combination.optionValues,
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
