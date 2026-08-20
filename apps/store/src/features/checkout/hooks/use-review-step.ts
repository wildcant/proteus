import { useNavigate } from '@tanstack/react-router'
import { useCompleteCart } from '#/features/checkout/api/checkout'

export function useReviewStep() {
  const navigate = useNavigate()

  const completeCart = useCompleteCart({
    onSuccess: (response) => {
      navigate({ to: '/order/$orderId/confirmed', params: { orderId: response.orderId } })
    },
  })

  const handlePlaceOrder = () => {
    completeCart.mutate()
  }

  return { handlePlaceOrder, isPending: completeCart.isPending, error: completeCart.error }
}
