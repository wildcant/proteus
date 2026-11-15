import { DEPOSIT_PERCENTAGE } from '@proteus/store-config'
import type { AdminDraftOrderResponseDraftOrder, AdminOrderActionResponse } from '#/api/generated/model'
import { useConvertDraftOrder } from '#/features/draft-orders/api/draft-orders'
import {
  convertDraftDefaults,
  convertDraftPayload,
  convertDraftSchema,
} from '#/features/draft-orders/utils/convert-draft'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type ConvertDraftFormParams = SubmitFormParams<AdminOrderActionResponse>

/** Converting and recording the deposit are one action, so stock is held exactly when the deposit arrives. */
export function useConvertDraftForm(draftOrder: AdminDraftOrderResponseDraftOrder, params?: ConvertDraftFormParams) {
  const convertMutation = useConvertDraftOrder(draftOrder.id)

  const form = useAppForm({
    defaultValues: convertDraftDefaults(draftOrder, DEPOSIT_PERCENTAGE),
    validators: { onSubmit: convertDraftSchema(draftOrder.totals.outstandingTotal) },
    onSubmit: async ({ value }) => {
      try {
        const data = await convertMutation.mutateAsync(convertDraftPayload(value))
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
