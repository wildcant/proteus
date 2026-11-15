import type { AdminOrderActionResponse, AdminOrderResponseOrder } from '#/api/generated/model'
import { useCancelOrder } from '#/features/orders/api/orders'
import { cancelOrderDefaults, cancelOrderSchema } from '#/features/orders/utils/payment-amounts'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

export type CancelOrderFormParams = SubmitFormParams<AdminOrderActionResponse>

/** Canceling an Order that has received money, which asks how much of it goes back. */
export function useCancelOrderForm(order: AdminOrderResponseOrder, params?: CancelOrderFormParams) {
  const cancelMutation = useCancelOrder(order.id)

  const form = useAppForm({
    defaultValues: cancelOrderDefaults(order.totals.paidTotal),
    validators: { onSubmit: cancelOrderSchema(order.totals.paidTotal) },
    onSubmit: async ({ value }) => {
      try {
        const data = await cancelMutation.mutateAsync({ refundAmount: value.refundAmount })
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
