import type { AdminDraftOrderResponse, AdminDraftOrderResponseDraftOrder } from '#/api/generated/model'
import { useUpdateDraftOrder } from '#/features/draft-orders/api/draft-orders'
import {
  draftContactDefaults,
  draftContactPayload,
  draftContactSchema,
} from '#/features/draft-orders/utils/draft-contact'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type EditDraftContactFormParams = SubmitFormParams<AdminDraftOrderResponse>

export function useEditDraftContactForm(
  draftOrder: AdminDraftOrderResponseDraftOrder,
  params?: EditDraftContactFormParams,
) {
  const updateMutation = useUpdateDraftOrder(draftOrder.id)

  const form = useAppForm({
    defaultValues: draftContactDefaults(draftOrder),
    validators: { onSubmit: draftContactSchema },
    onSubmit: async ({ value }) => {
      try {
        const data = await updateMutation.mutateAsync(draftContactPayload(value))
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
