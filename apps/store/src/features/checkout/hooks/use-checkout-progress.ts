import { useNavigate } from '@tanstack/react-router'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import type { Step } from '#/features/checkout/constants'

export function useCheckoutProgress(cart: StoreCartDetailResponseCart) {
  const navigate = useNavigate()

  const hasAddress = !!cart.shippingAddress
  const hasShipping = cart.shippingMethods.length > 0

  const goToStep = (step: Step) => {
    navigate({ to: '/checkout', search: { step }, replace: true })
  }

  const lastShippingMethod = cart.shippingMethods.at(-1)

  return { hasAddress, hasShipping, goToStep, lastShippingMethod }
}
