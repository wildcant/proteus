import type { AdminDraftOrderResponse, AdminDraftOrderResponseDraftOrder } from '#/api/generated/model'
import { useSetDraftOrderShippingMethod } from '#/features/draft-orders/api/draft-orders'
import {
  draftShippingDefaults,
  draftShippingPayload,
  draftShippingSchema,
} from '#/features/draft-orders/utils/draft-shipping'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type EditDraftShippingFormParams = SubmitFormParams<AdminDraftOrderResponse>

export function useEditDraftShippingForm(
  draftOrder: AdminDraftOrderResponseDraftOrder,
  params?: EditDraftShippingFormParams,
) {
  const shippingMutation = useSetDraftOrderShippingMethod(draftOrder.id)

  const form = useAppForm({
    defaultValues: draftShippingDefaults(draftOrder),
    validators: { onSubmit: draftShippingSchema },
    onSubmit: async ({ value }) => {
      try {
        const data = await shippingMutation.mutateAsync(draftShippingPayload(value))
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
