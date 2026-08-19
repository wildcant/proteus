import { toast } from '@proteus/ui'
import { useNavigate } from '@tanstack/react-router'
import { useCompleteCart } from '#/features/checkout/api/checkout'

export function useReviewStep() {
  const navigate = useNavigate()

  const completeCart = useCompleteCart({
    onSuccess: (response) => {
      navigate({ to: '/order/$orderId/confirmed', params: { orderId: response.orderId } })
    },
    onError: (error) => toast.add({ type: 'error', title: error.message }),
  })

  const handlePlaceOrder = () => {
    completeCart.mutate()
  }

  return { handlePlaceOrder, isPending: completeCart.isPending, error: completeCart.error }
}
