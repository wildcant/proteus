import { useState } from 'react'
import { z } from 'zod'
import type { AdminCreateProductVariantResponse } from '#/api/generated/model'
import { useCreateProductVariant, useOptionCombinations } from '#/features/products/api/product-variants'
import { useDebouncedValue } from '#/hooks/use-debounced-value'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

/**
 * The form holds the combination's `key`, not the option values themselves — picking a combination
 * is one choice, so it is one field. Title and SKU stay optional: an omitted title takes the
 * combination's label server-side.
 */
const createVariantSchema = z.object({
  combinationKey: z.string(),
  title: z.string(),
  sku: z.string(),
})

type UseCreateVariantFormArgs = {
  productId: string
  params?: SubmitFormParams<AdminCreateProductVariantResponse>
}

export function useCreateVariantForm({ productId, params }: UseCreateVariantFormArgs) {
  const createMutation = useCreateProductVariant(productId)

  // The combobox filters server-side, so the query follows what was typed rather than the page
  // being narrowed locally — which is what lets this work for a product with thousands of them.
  const [search, setSearch] = useState('')
  const { data, isPending } = useOptionCombinations(productId, { label: useDebouncedValue(search) || undefined })

  // Only the ones no variant has yet. That single filter is the whole "already taken" rule.
  const available = (data?.combinations ?? []).filter((combination) => !combination.variantId)
  const byKey = new Map(available.map((combination) => [combination.key, combination]))

  const form = useAppForm({
    defaultValues: { combinationKey: '', title: '', sku: '' } satisfies z.infer<typeof createVariantSchema>,
    validators: { onSubmit: createVariantSchema },
    onSubmit: ({ value }) => {
      const combination = byKey.get(value.combinationKey)

      createMutation.mutate(
        {
          // Omitted rather than sent empty, so the service falls back to the combination's label.
          ...(value.title ? { title: value.title } : {}),
          sku: value.sku || null,
          ...(combination ? { optionValues: combination.optionValues } : {}),
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

  return {
    form,
    available,
    /** What the title field shows when the user has typed nothing of their own. */
    labelFor: (key: string): string | undefined => byKey.get(key)?.label,
    onSearchChange: setSearch,
    /** True once the product has options but every combination of them is spoken for. */
    isExhausted: !isPending && !search && available.length === 0 && (data?.count ?? 0) > 0,
    hasNoOptions: !isPending && (data?.count ?? 0) === 0,
    isPending,
    isLoading: createMutation.isPending,
  }
}
