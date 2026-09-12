import { AdminUpdateProductVariant } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import type { AdminProductVariant, AdminUpdateProductVariantResponse } from '#/api/generated/model'
import { useUpdateProductVariant } from '#/features/products/api/product-variants'
import type { CombinationOption } from '#/features/products/hooks/use-option-combination-search'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/**
 * The variant's own fields come from the endpoint's schema; `combination` is the one field that is
 * not a column — it stands for the Option Combination the variant will carry, and the payload takes
 * its `optionValues`.
 */
const editVariantSchema = AdminUpdateProductVariant.pick({ sku: true, material: true }).extend({
  combination: z.custom<CombinationOption>().nullable(),
})

type EditVariantFormParams = SubmitFormParams<AdminUpdateProductVariantResponse>

type UseEditVariantFormArgs = {
  productId: string
  variant: AdminProductVariant
  /** The combination the variant holds today, from `useOptionCombinationSearch`. */
  current?: CombinationOption
  params?: EditVariantFormParams
}

export function useEditVariantForm({ productId, variant, current, params }: UseEditVariantFormArgs) {
  const updateMutation = useUpdateProductVariant(productId, variant.id)

  const defaultValues: z.input<typeof editVariantSchema> = {
    combination: current ?? null,
    sku: variant.sku ?? '',
    material: variant.material ?? '',
  }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: editVariantSchema },
    onSubmit: async ({ value }) => {
      try {
        // No title is sent: it is derived from the combination, so moving a variant from M/White to
        // L/White retitles it server-side.
        const updated = await updateMutation.mutateAsync({
          sku: value.sku || null,
          material: value.material || null,
          ...(value.combination ? { optionValues: value.combination.optionValues } : {}),
        })
        form.reset()
        params?.onSuccess?.(updated)
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
