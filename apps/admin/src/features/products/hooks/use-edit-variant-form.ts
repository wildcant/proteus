import { useState } from 'react'
import { z } from 'zod'
import type { AdminProductVariant, AdminUpdateProductVariantResponse } from '#/api/generated/model'
import { useOptionCombinations, useUpdateProductVariant } from '#/features/products/api/product-variants'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

const editVariantSchema = z.object({
  combinationKey: z.string(),
  title: z.string(),
  sku: z.string(),
  material: z.string(),
})

export type EditVariantFormParams = SubmitFormParams<AdminUpdateProductVariantResponse>

type UseEditVariantFormArgs = {
  productId: string
  variant: AdminProductVariant
  params?: EditVariantFormParams
}

export function useEditVariantForm({ productId, variant, params }: UseEditVariantFormArgs) {
  const updateMutation = useUpdateProductVariant(productId, variant.id)

  const [search, setSearch] = useState('')
  const { data, isPending } = useOptionCombinations(productId, { label: useDebouncedValue(search) || undefined })

  // The free ones plus this variant's own — a variant must be able to keep the combination it
  // already has, and everything else is taken by definition.
  const combinations = data?.combinations ?? []
  const available = combinations.filter((combination) => !combination.variantId || combination.variantId === variant.id)
  const byKey = new Map(available.map((combination) => [combination.key, combination]))
  const current = combinations.find((combination) => combination.variantId === variant.id)

  const form = useAppForm({
    defaultValues: {
      combinationKey: current?.key ?? '',
      title: variant.title,
      sku: variant.sku ?? '',
      material: variant.material ?? '',
    },
    validators: { onSubmit: editVariantSchema },
    onSubmit: ({ value }) => {
      const combination = byKey.get(value.combinationKey)
      // Sending the title only when it was edited by hand is what lets the service retitle a
      // variant that moved from M/White to L/White, rather than leaving the old name behind.
      const titleWasEdited = form.state.fieldMeta.title?.isDirty ?? false

      updateMutation.mutate(
        {
          ...(titleWasEdited && value.title ? { title: value.title } : {}),
          sku: value.sku || null,
          material: value.material || null,
          ...(combination ? { optionValues: combination.optionValues } : {}),
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

  return {
    form,
    available,
    onSearchChange: setSearch,
    /** A product with no options offers no combinations, so the field has nothing to show. */
    hasNoOptions: !isPending && combinations.length === 0 && !search,
    isPending,
    isLoading: updateMutation.isPending,
  }
}
