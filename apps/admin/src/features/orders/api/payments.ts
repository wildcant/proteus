import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import type { AdminPaymentResponse, AdminRefundPayment } from '#/api/generated/model'
import { refundPayment } from '#/api/generated/payments/payments'
import { orderKeys } from '#/features/orders/api/orders'
import { queryClient } from '#/lib/query-client'

/** A refund of an Order's payment; the Order is what shows it, so the Order is what refreshes. */
export const useRefundPayment = (
  orderId: string,
  paymentId: string,
  options?: UseMutationOptions<AdminPaymentResponse, Error, AdminRefundPayment>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminRefundPayment) => refundPayment(paymentId, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to refund payment`, description: error.message })
      onError?.(...args)
    },
  })
}
