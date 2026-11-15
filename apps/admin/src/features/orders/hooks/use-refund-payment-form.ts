import type { AdminPayment, AdminPaymentResponse } from '#/api/generated/model'
import { useRefundPayment } from '#/features/orders/api/payments'
import { refundableAmount, refundPaymentSchema } from '#/features/orders/utils/payment-amounts'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type RefundPaymentFormParams = SubmitFormParams<AdminPaymentResponse>

export function useRefundPaymentForm(orderId: string, payment: AdminPayment, params?: RefundPaymentFormParams) {
  const refundMutation = useRefundPayment(orderId, payment.id)
  const refundable = refundableAmount(payment)

  const form = useAppForm({
    defaultValues: { amount: refundable, note: '' },
    validators: { onSubmit: refundPaymentSchema(refundable) },
    onSubmit: async ({ value }) => {
      try {
        const data = await refundMutation.mutateAsync({ amount: value.amount, note: value.note || undefined })
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
