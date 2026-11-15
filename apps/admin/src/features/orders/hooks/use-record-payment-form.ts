import { DEPOSIT_PERCENTAGE } from '@proteus/store-config'
import type { AdminOrderResponseOrder, AdminPaymentCollectionResponse } from '#/api/generated/model'
import { useRecordOrderPayment } from '#/features/orders/api/orders'
import { recordPaymentPrefill, recordPaymentSchema } from '#/features/orders/utils/payment-amounts'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type RecordPaymentFormParams = SubmitFormParams<AdminPaymentCollectionResponse>

export function useRecordPaymentForm(order: AdminOrderResponseOrder, params?: RecordPaymentFormParams) {
  const recordMutation = useRecordOrderPayment(order.id)

  const form = useAppForm({
    defaultValues: {
      amount: recordPaymentPrefill({
        orderTotal: order.totals.orderTotal,
        outstandingTotal: order.totals.outstandingTotal,
        currencyCode: order.currencyCode,
        isFirstPayment: order.transactions.length === 0,
        depositPercentage: DEPOSIT_PERCENTAGE,
      }),
    },
    validators: { onSubmit: recordPaymentSchema(order.totals.outstandingTotal) },
    onSubmit: async ({ value }) => {
      try {
        const data = await recordMutation.mutateAsync({ amount: value.amount })
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
