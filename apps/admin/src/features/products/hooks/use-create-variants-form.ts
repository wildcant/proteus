import { useMemo, useState } from 'react'
import type {
  AdminCreateProductVariantsBatchResponse,
  AdminProductOption,
  AdminProductVariant,
} from '#/api/generated/model'
import { useCreateProductVariantsBatch } from '#/features/products/api/product-variants'
import { buildVariantMatrix, type MatrixRow } from '#/features/products/matrix'
import type { SubmitFormParams } from '#/types/form.ts'

type UseCreateVariantsFormArgs = {
  productId: string
  options: AdminProductOption[]
  existingVariants: AdminProductVariant[]
  params?: SubmitFormParams<AdminCreateProductVariantsBatchResponse>
}

/**
 * Drives the matrix form: which values are ticked, which generated rows are kept, and the SKU
 * prefix. Not a TanStack form — the fields are a selection over generated rows rather than a fixed
 * shape, so the state is a plain reducer and the generation stays a pure function.
 */
export function useCreateVariantsForm({ productId, options, existingVariants, params }: UseCreateVariantsFormArgs) {
  const createMutation = useCreateProductVariantsBatch(productId)

  // Every value starts ticked: creating the full matrix is the common case.
  const [selectedValueIds, setSelectedValueIds] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(options.map((option) => [option.id, option.values.map((value) => value.id)])),
  )
  const [skuPrefix, setSkuPrefix] = useState('')
  const [excludedKeys, setExcludedKeys] = useState<Record<string, boolean>>({})

  const rows = useMemo(
    () => buildVariantMatrix({ options, selectedValueIds, existingVariants, skuPrefix }),
    [options, selectedValueIds, existingVariants, skuPrefix],
  )
  const included = rows.filter((row) => !excludedKeys[row.key])

  const toggleValue = (optionId: string, valueId: string) =>
    setSelectedValueIds((current) => {
      const chosen = current[optionId] ?? []
      const next = chosen.includes(valueId) ? chosen.filter((id) => id !== valueId) : [...chosen, valueId]
      return { ...current, [optionId]: next }
    })

  const toggleRow = (key: string) => setExcludedKeys((current) => ({ ...current, [key]: !current[key] }))

  const submit = () => {
    if (included.length === 0) return

    createMutation.mutate(
      {
        variants: included.map((row: MatrixRow) => ({
          title: row.title,
          sku: row.sku || null,
          optionValues: row.optionValues,
        })),
      },
      {
        onSuccess: (data) => params?.onSuccess?.(data),
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      },
    )
  }

  return {
    rows,
    included,
    selectedValueIds,
    skuPrefix,
    excludedKeys,
    setSkuPrefix,
    toggleValue,
    toggleRow,
    submit,
    isLoading: createMutation.isPending,
  }
}
