import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { useCompleteCart } from '../api/checkout'

/**
 * What happens after a gateway says yes, on both success paths.
 *
 * `redirect: 'if_required'` splits success permanently in two, and which branch a shopper takes is
 * a property of their country rather than their order. One function, called by the place-order
 * press and by the checkout return route, is what stops the redirect path rotting while every
 * local test passes — there is nothing on either side of the split that the other does not do.
 *
 * Neither path writes anything down about money: `completeCart` creates the order and authorizes
 * the session, payment truth arrives by webhook, and the browser only changes what is on screen.
 */
export function useCompleteOrder() {
  const navigate = useNavigate()
  const completeCart = useCompleteCart()

  const completeOrder = useCallback(async () => {
    const order = await completeCart.mutateAsync()
    await navigate({ to: '/order/$orderId/confirmed', params: { orderId: order.orderId } })
    return order
  }, [completeCart, navigate])

  return { completeOrder, isCompleting: completeCart.isPending }
}
