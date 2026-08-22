import { z } from 'zod'
import type {
  AdminOptionCombination,
  AdminProductVariant,
  AdminUpdateProductVariantResponse,
} from '#/api/generated/model'
import { useUpdateProductVariant } from '#/features/products/api/product-variants'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

const editVariantSchema = z.object({
  combination: z.custom<AdminOptionCombination>().nullable(),
  title: z.string(),
  sku: z.string(),
  material: z.string(),
})

export type EditVariantFormParams = SubmitFormParams<AdminUpdateProductVariantResponse>

type UseEditVariantFormArgs = {
  productId: string
  variant: AdminProductVariant
  /** The combination the variant holds today, from `useOptionCombinationSearch`. */
  current?: AdminOptionCombination
  params?: EditVariantFormParams
}

export function useEditVariantForm({ productId, variant, current, params }: UseEditVariantFormArgs) {
  const updateMutation = useUpdateProductVariant(productId, variant.id)

  const defaultValues: z.infer<typeof editVariantSchema> = {
    combination: current ?? null,
    title: variant.title,
    sku: variant.sku ?? '',
    material: variant.material ?? '',
  }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: editVariantSchema },
    onSubmit: ({ value }) => {
      // Sending the title only when it was edited by hand is what lets the service retitle a
      // variant that moved from M/White to L/White, rather than leaving the old name behind.
      const titleWasEdited = form.state.fieldMeta.title?.isDirty ?? false

      updateMutation.mutate(
        {
          ...(titleWasEdited && value.title ? { title: value.title } : {}),
          sku: value.sku || null,
          material: value.material || null,
          ...(value.combination ? { optionValues: value.combination.optionValues } : {}),
        },
        {
          onSuccess: (updated) => {
            form.reset()
            params?.onSuccess?.(updated)
          },
          onError: (error) => params?.onError?.(error.message),
          onSettled: () => params?.onSettled?.(),
        },
      )
    },
  })

  return { form, isLoading: updateMutation.isPending }
}
