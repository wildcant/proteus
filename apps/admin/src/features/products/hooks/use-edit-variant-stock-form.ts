import { AdminSetVariantStock, type AdminSetVariantStockBody } from '@proteus/http-schemas/admin'
import type { AdminProductVariantResponseVariant, AdminSetVariantStockResponse } from '#/api/generated/model'
import { useSetVariantStock } from '#/features/products/api/product-variants'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

type EditVariantStockFormParams = SubmitFormParams<AdminSetVariantStockResponse>

export function useEditVariantStockForm(
  productId: string,
  variant: AdminProductVariantResponseVariant,
  params?: EditVariantStockFormParams,
) {
  const updateStock = useSetVariantStock(productId, variant.id)
  const form = useAppForm({
    defaultValues: {
      stockedQuantity: variant.stock?.stockedQuantity ?? 0,
    } satisfies AdminSetVariantStockBody as AdminSetVariantStockBody,
    validators: { onSubmit: AdminSetVariantStock },
    onSubmit: async ({ value }) => {
      try {
        const stock = await updateStock.mutateAsync(value)
        form.reset()
        params?.onSuccess?.(stock)
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
